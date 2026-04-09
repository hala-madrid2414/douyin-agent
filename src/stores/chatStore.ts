import { MOCK_CHAT_SESSIONS, STATIC_AI_REPLY } from '@/constants/chat';
import {
  CHAT_CACHE_SCHEMA_VERSION,
  CHAT_CACHE_TTL_MS,
} from '@/constants/session';
import type {
  ConversationEntity,
  ConversationId,
  ConversationMessage,
  ConversationSummary,
  ToolCallTrace,
} from '@/types/session';
import { createConversationId, isConversationId } from '@/utils/conversationId';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const DEFAULT_USER_ID = 'mock-user';
const CHAT_STORE_KEY = 'chat-store';

interface ChatUserBucket {
  conversationsById: Record<ConversationId, ConversationEntity>;
  order: ConversationId[];
  draftByConversationId: Record<ConversationId, string>;
  persistedAt: number;
  seedSignature?: string;
}

const abortControllers = new Map<ConversationId, AbortController>();

interface ChatStoreState {
  activeUserId: string;
  byUser: Record<string, ChatUserBucket>;
  setActiveUser: (userId: string) => void;
  ensureConversation: (conversationId: ConversationId) => void;
  createConversation: () => ConversationId;
  setDraft: (conversationId: ConversationId, draft: string) => void;
  appendMessage: (
    conversationId: ConversationId,
    message: Omit<ConversationMessage, 'createdAt'> & { createdAt?: string },
  ) => void;
  sendMessage: (
    conversationId: ConversationId,
    content: string,
    options?: { enableThinking?: boolean; forceToolCall?: boolean },
  ) => Promise<void>;
  updateMessage: (
    conversationId: ConversationId,
    messageId: string,
    updates: Partial<ConversationMessage>,
  ) => void;
  stopMessage: (conversationId: ConversationId) => void;
}

const nowIso = () => new Date().toISOString();

const TOOL_TITLE_FALLBACK: Record<string, string> = {
  qweather: '和风天气查询',
  tavily: '联网旅行信息查询',
};

const TOOL_STATUS_MAP: Record<string, ToolCallTrace['status']> = {
  start: 'loading',
  success: 'success',
  error: 'error',
  abort: 'abort',
};

const MOCK_SESSION_SIGNATURE = JSON.stringify(
  MOCK_CHAT_SESSIONS.map(session => ({
    id: session.id,
    title: session.title,
    messages: session.messages.map(message => ({
      role: message.role,
      content: message.content,
    })),
  })),
);

const normalizeConversationId = (
  rawId: string,
  index: number,
): ConversationId => {
  if (isConversationId(rawId)) {
    return rawId;
  }
  return `17${`${index}`.padStart(15, '0')}`;
};

const createConversationFromMock = (
  index: number,
  mock: (typeof MOCK_CHAT_SESSIONS)[number],
): ConversationEntity => {
  const createdAt = new Date(
    Date.now() - (index + 1) * 60 * 60 * 1000,
  ).toISOString();
  const updatedAt = new Date(Date.now() - index * 40 * 60 * 1000).toISOString();
  const id = normalizeConversationId(mock.id, index + 1);
  const messages: ConversationMessage[] = mock.messages.map(
    (message, messageIndex) => ({
      id: `${id}-${message.role}-${messageIndex + 1}`,
      role: message.role,
      content: message.content,
      status: 'complete',
      createdAt: new Date(
        Date.now() - (index + 1) * 60 * 60 * 1000 + messageIndex * 1000,
      ).toISOString(),
    }),
  );
  const lastMessagePreview =
    messages[messages.length - 1]?.content.slice(0, 80) ?? '';
  return {
    id,
    title: mock.title,
    createdAt,
    updatedAt,
    lastMessagePreview,
    messageCount: messages.length,
    messages,
  };
};

const createInitialBucket = (withMock: boolean): ChatUserBucket => {
  if (!withMock) {
    return {
      conversationsById: {},
      order: [],
      draftByConversationId: {},
      persistedAt: Date.now(),
    };
  }

  const entities = MOCK_CHAT_SESSIONS.map((session, index) =>
    createConversationFromMock(index, session),
  );
  const conversationsById = Object.fromEntries(
    entities.map(entity => [entity.id, entity]),
  ) as Record<ConversationId, ConversationEntity>;
  const order = [...entities]
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .map(entity => entity.id);

  return {
    conversationsById,
    order,
    draftByConversationId: {},
    persistedAt: Date.now(),
    seedSignature: MOCK_SESSION_SIGNATURE,
  };
};

const dedupeConversationOrder = (order: ConversationId[]): ConversationId[] => {
  const seen = new Set<ConversationId>();
  return order.filter(id => {
    if (seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
};

const sortConversationOrder = (bucket: ChatUserBucket): ConversationId[] => {
  return dedupeConversationOrder(bucket.order).sort((leftId, rightId) => {
    const left = bucket.conversationsById[leftId];
    const right = bucket.conversationsById[rightId];
    if (!left || !right) {
      return 0;
    }
    return (
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    );
  });
};

const withBucket = (
  byUser: Record<string, ChatUserBucket>,
  userId: string,
): Record<string, ChatUserBucket> => {
  if (byUser[userId]) {
    return byUser;
  }
  return {
    ...byUser,
    [userId]: createInitialBucket(false),
  };
};

const sanitizeByUser = (rawByUser: unknown): Record<string, ChatUserBucket> => {
  if (!rawByUser || typeof rawByUser !== 'object') {
    return {};
  }

  const now = Date.now();
  const sanitized = Object.entries(
    rawByUser as Record<string, ChatUserBucket>,
  ).reduce(
    (result, [userId, bucket]) => {
      if (!bucket || typeof bucket !== 'object') {
        return result;
      }
      if (
        typeof bucket.persistedAt !== 'number' ||
        now - bucket.persistedAt > CHAT_CACHE_TTL_MS
      ) {
        return result;
      }
      const conversationsById =
        bucket.conversationsById && typeof bucket.conversationsById === 'object'
          ? bucket.conversationsById
          : {};
      const rawOrder = Array.isArray(bucket.order)
        ? bucket.order.filter(
            (id): id is ConversationId =>
              typeof id === 'string' && Boolean(conversationsById[id]),
          )
        : [];
      if (userId === DEFAULT_USER_ID) {
        const seededBucket = createInitialBucket(true);
        const seededIds = new Set<ConversationId>(
          Object.keys(seededBucket.conversationsById).filter(
            (id): id is ConversationId => typeof id === 'string',
          ),
        );
        const extraConversations = Object.fromEntries(
          Object.entries(conversationsById).filter(
            ([id]) => !seededIds.has(id),
          ),
        ) as Record<ConversationId, ConversationEntity>;
        const mergedConversationsById = {
          ...seededBucket.conversationsById,
          ...extraConversations,
        };
        const completedOrder = dedupeConversationOrder([
          ...rawOrder.filter(id => Boolean(mergedConversationsById[id])),
          ...seededBucket.order,
          ...Object.keys(extraConversations).filter(
            (id): id is ConversationId => typeof id === 'string',
          ),
        ]);
        result[userId] = {
          conversationsById: mergedConversationsById,
          order: sortConversationOrder({
            conversationsById: mergedConversationsById,
            order: completedOrder,
            draftByConversationId:
              bucket.draftByConversationId &&
              typeof bucket.draftByConversationId === 'object'
                ? bucket.draftByConversationId
                : {},
            persistedAt: bucket.persistedAt,
            seedSignature: MOCK_SESSION_SIGNATURE,
          }),
          draftByConversationId:
            bucket.draftByConversationId &&
            typeof bucket.draftByConversationId === 'object'
              ? bucket.draftByConversationId
              : {},
          persistedAt: bucket.persistedAt,
          seedSignature: MOCK_SESSION_SIGNATURE,
        };
        return result;
      }
      const completedOrder = dedupeConversationOrder([
        ...rawOrder,
        ...Object.keys(conversationsById).filter(
          (id): id is ConversationId => typeof id === 'string',
        ),
      ]);
      result[userId] = {
        conversationsById,
        order: sortConversationOrder({
          conversationsById,
          order: completedOrder,
          draftByConversationId:
            bucket.draftByConversationId &&
            typeof bucket.draftByConversationId === 'object'
              ? bucket.draftByConversationId
              : {},
          persistedAt: bucket.persistedAt,
        }),
        draftByConversationId:
          bucket.draftByConversationId &&
          typeof bucket.draftByConversationId === 'object'
            ? bucket.draftByConversationId
            : {},
        persistedAt: bucket.persistedAt,
        seedSignature:
          typeof bucket.seedSignature === 'string'
            ? bucket.seedSignature
            : undefined,
      };
      return result;
    },
    {} as Record<string, ChatUserBucket>,
  );

  return sanitized;
};

const createMessageId = (
  conversationId: ConversationId,
  role: string,
): string => {
  return `${conversationId}-${role}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
};

export const useChatStore = create<ChatStoreState>()(
  persist(
    (set, get) => ({
      activeUserId: DEFAULT_USER_ID,
      byUser: {
        [DEFAULT_USER_ID]: createInitialBucket(true),
      },
      setActiveUser: userId => {
        if (!userId) {
          return;
        }
        set(state => {
          const byUser = withBucket(state.byUser, userId);
          return {
            activeUserId: userId,
            byUser,
          };
        });
      },
      ensureConversation: conversationId => {
        set(state => {
          const userId = state.activeUserId;
          const existingBucket =
            state.byUser[userId] ?? createInitialBucket(false);
          if (existingBucket.conversationsById[conversationId]) {
            return state;
          }
          const timestamp = nowIso();
          const entity: ConversationEntity = {
            id: conversationId,
            title: '新对话',
            createdAt: timestamp,
            updatedAt: timestamp,
            lastMessagePreview: '',
            messageCount: 0,
            messages: [],
          };
          const nextBucket: ChatUserBucket = {
            ...existingBucket,
            conversationsById: {
              ...existingBucket.conversationsById,
              [conversationId]: entity,
            },
            order: [
              conversationId,
              ...existingBucket.order.filter(id => id !== conversationId),
            ],
            persistedAt: Date.now(),
          };
          return {
            byUser: {
              ...state.byUser,
              [userId]: nextBucket,
            },
          };
        });
      },
      createConversation: () => {
        const id = createConversationId();
        get().ensureConversation(id);
        return id;
      },
      setDraft: (conversationId, draft) => {
        set(state => {
          const userId = state.activeUserId;
          const existingBucket =
            state.byUser[userId] ?? createInitialBucket(false);
          const nextBucket: ChatUserBucket = {
            ...existingBucket,
            draftByConversationId: {
              ...existingBucket.draftByConversationId,
              [conversationId]: draft,
            },
            persistedAt: Date.now(),
          };
          return {
            byUser: {
              ...state.byUser,
              [userId]: nextBucket,
            },
          };
        });
      },
      appendMessage: (conversationId, message) => {
        set(state => {
          const userId = state.activeUserId;
          const existingBucket =
            state.byUser[userId] ?? createInitialBucket(false);
          const currentConversation =
            existingBucket.conversationsById[conversationId];
          const baseConversation: ConversationEntity =
            currentConversation ??
            ({
              id: conversationId,
              title: '新对话',
              createdAt: nowIso(),
              updatedAt: nowIso(),
              lastMessagePreview: '',
              messageCount: 0,
              messages: [],
            } as ConversationEntity);

          const createdAt = message.createdAt ?? nowIso();
          const nextMessage: ConversationMessage = {
            ...message,
            createdAt,
          };
          const nextMessages = [...baseConversation.messages, nextMessage];
          const lastMessagePreview = nextMessage.content.slice(0, 80);
          const nextTitle =
            baseConversation.messageCount === 0 && nextMessage.role === 'user'
              ? lastMessagePreview || '新对话'
              : baseConversation.title;
          const updatedAt = nowIso();
          const nextConversation: ConversationEntity = {
            ...baseConversation,
            title: nextTitle,
            updatedAt,
            lastMessagePreview,
            messageCount: nextMessages.length,
            messages: nextMessages,
          };
          const nextBucket: ChatUserBucket = {
            ...existingBucket,
            conversationsById: {
              ...existingBucket.conversationsById,
              [conversationId]: nextConversation,
            },
            order: sortConversationOrder({
              ...existingBucket,
              conversationsById: {
                ...existingBucket.conversationsById,
                [conversationId]: nextConversation,
              },
              order: [
                conversationId,
                ...existingBucket.order.filter(id => id !== conversationId),
              ],
            }),
            persistedAt: Date.now(),
          };
          return {
            byUser: {
              ...state.byUser,
              [userId]: nextBucket,
            },
          };
        });
      },
      sendMessage: async (
        conversationId: ConversationId,
        content: string,
        options?: { enableThinking?: boolean; forceToolCall?: boolean },
      ) => {
        // 1. 若当前会话已有进行中的请求，先中止它
        get().stopMessage(conversationId);

        const userMessageId = createMessageId(conversationId, 'user');
        // 2. 追加用户消息并设为 loading
        get().appendMessage(conversationId, {
          id: userMessageId,
          role: 'user',
          content,
          status: 'complete',
        });

        const assistantMessageId = createMessageId(conversationId, 'assistant');
        get().appendMessage(conversationId, {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          status: 'loading',
          toolTrace: [],
        });

        const controller = new AbortController();
        abortControllers.set(conversationId, controller);

        try {
          let aiReplyContent = '';
          let aiThinkingContent = '';
          // 3. 调用真实的 BFF 接口
          await fetchEventSource('/api/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
            body: JSON.stringify({
              conversationId,
              content,
              enableThinking: options?.enableThinking,
              forceToolCall: options?.forceToolCall,
            }),
            async onopen(response) {
              if (
                !response.ok &&
                response.headers.get('content-type')?.includes('json')
              ) {
                const err = await response.json();
                throw new Error(err.message || 'Server Error');
              }
            },
            onmessage(event) {
              if (controller.signal.aborted) {
                return;
              }
              if (event.event === 'thinking') {
                try {
                  const data = JSON.parse(event.data);
                  if (data.content) {
                    aiThinkingContent += data.content;
                    get().updateMessage(conversationId, assistantMessageId, {
                      thinkingContent: aiThinkingContent,
                    });
                  }
                } catch (e) {
                  console.error('Failed to parse SSE thinking message:', e);
                }
              } else if (event.event === 'message') {
                try {
                  const data = JSON.parse(event.data);
                  if (data.content) {
                    aiReplyContent += data.content;
                    get().updateMessage(conversationId, assistantMessageId, {
                      content: aiReplyContent,
                    });
                  }
                } catch (e) {
                  console.error('Failed to parse SSE message:', e);
                }
              } else if (event.event === 'tool_status') {
                try {
                  const data = JSON.parse(event.data);
                  const toolKey = String(data.tool || 'tavily').toLowerCase();
                  const normalizedStatus = String(
                    data.status || 'start',
                  ).toLowerCase();
                  const status = TOOL_STATUS_MAP[normalizedStatus] ?? 'loading';
                  const nextTrace: ToolCallTrace = {
                    key: toolKey,
                    title: String(
                      data.title || TOOL_TITLE_FALLBACK[toolKey] || '工具调用',
                    ),
                    description: data.detail ? String(data.detail) : undefined,
                    status,
                  };
                  const state = get();
                  const activeBucket = state.byUser[state.activeUserId];
                  const activeConversation =
                    activeBucket?.conversationsById[conversationId];
                  const assistantMessage = activeConversation?.messages.find(
                    msg => msg.id === assistantMessageId,
                  );
                  const previousTrace = assistantMessage?.toolTrace ?? [];
                  const existedIndex = previousTrace.findIndex(
                    trace => trace.key === nextTrace.key,
                  );
                  const mergedTrace =
                    existedIndex >= 0
                      ? previousTrace.map((trace, index) =>
                          index === existedIndex
                            ? { ...trace, ...nextTrace }
                            : trace,
                        )
                      : [...previousTrace, nextTrace];
                  get().updateMessage(conversationId, assistantMessageId, {
                    toolTrace: mergedTrace,
                  });
                } catch (e) {
                  console.error('Failed to parse SSE tool_status event:', e);
                }
              } else if (event.event === 'done') {
                get().updateMessage(conversationId, assistantMessageId, {
                  status: 'complete',
                });
              }
            },
            onerror(error) {
              console.error('SSE Error:', error);
              throw error; // 抛出异常以阻止自动重试
            },
          });
        } catch (error: unknown) {
          // 4. 判断是否为主动中止
          if (error instanceof Error && error.name === 'AbortError') {
            console.log('Stream aborted for conversation:', conversationId);
            return;
          }
          // 5. 网络或其它异常
          console.error('Failed to send message:', error);
          get().updateMessage(conversationId, assistantMessageId, {
            content: '暂时无法为你规划行程，请稍后重试',
            status: 'error',
          });
        } finally {
          abortControllers.delete(conversationId);
        }
      },
      updateMessage: (
        conversationId: ConversationId,
        messageId: string,
        updates: Partial<ConversationMessage>,
      ) => {
        set(state => {
          const userId = state.activeUserId;
          const bucket = state.byUser[userId];
          if (!bucket) return state;

          const conversation = bucket.conversationsById[conversationId];
          if (!conversation) return state;

          const nextMessages = conversation.messages.map(msg => {
            if (msg.id === messageId) {
              if (msg.status === 'aborted') {
                // Keep aborted message immutable for content/thinking,
                // but allow toolTrace/status sync for terminal tool states.
                if (
                  typeof updates.status === 'undefined' &&
                  typeof updates.toolTrace === 'undefined'
                ) {
                  return msg;
                }
                return {
                  ...msg,
                  ...(typeof updates.status !== 'undefined'
                    ? { status: updates.status }
                    : {}),
                  ...(typeof updates.toolTrace !== 'undefined'
                    ? { toolTrace: updates.toolTrace }
                    : {}),
                };
              }
              return { ...msg, ...updates };
            }
            return msg;
          });

          const nextConversation = {
            ...conversation,
            messages: nextMessages,
            updatedAt: nowIso(),
            lastMessagePreview:
              nextMessages[nextMessages.length - 1]?.content.slice(0, 80) ||
              conversation.lastMessagePreview,
          };

          return {
            byUser: {
              ...state.byUser,
              [userId]: {
                ...bucket,
                conversationsById: {
                  ...bucket.conversationsById,
                  [conversationId]: nextConversation,
                },
                order: sortConversationOrder({
                  ...bucket,
                  conversationsById: {
                    ...bucket.conversationsById,
                    [conversationId]: nextConversation,
                  },
                  order: bucket.order,
                }),
              },
            },
          };
        });
      },
      stopMessage: (conversationId: ConversationId) => {
        const controller = abortControllers.get(conversationId);
        if (controller) {
          controller.abort();
          abortControllers.delete(conversationId);
        }

        set(state => {
          const userId = state.activeUserId;
          const bucket = state.byUser[userId];
          if (!bucket) return state;

          const conversation = bucket.conversationsById[conversationId];
          if (!conversation) return state;

          let updated = false;
          const nextMessages = conversation.messages.map(msg => {
            if (msg.role === 'assistant' && msg.status === 'loading') {
              updated = true;
              return { ...msg, status: 'aborted' as const };
            }
            return msg;
          });

          if (!updated) return state;

          const nextConversation = {
            ...conversation,
            messages: nextMessages,
            updatedAt: nowIso(),
          };

          return {
            byUser: {
              ...state.byUser,
              [userId]: {
                ...bucket,
                conversationsById: {
                  ...bucket.conversationsById,
                  [conversationId]: nextConversation,
                },
              },
            },
          };
        });
      },
    }),
    {
      name: CHAT_STORE_KEY,
      version: CHAT_CACHE_SCHEMA_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({
        activeUserId: state.activeUserId,
        byUser: state.byUser,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<
          Pick<ChatStoreState, 'activeUserId' | 'byUser'>
        >;
        const sanitizedByUser = sanitizeByUser(persisted.byUser);
        const activeUserId =
          persisted.activeUserId || currentState.activeUserId;
        const withActive = withBucket(sanitizedByUser, activeUserId);
        if (Object.keys(withActive).length === 0) {
          return currentState;
        }
        return {
          ...currentState,
          activeUserId,
          byUser: withActive,
        };
      },
    },
  ),
);

export const selectConversationSummaries = (
  state: ChatStoreState,
  normalizedConversationId?: string | null,
): ConversationSummary[] => {
  const bucket = state.byUser[state.activeUserId];
  if (!bucket) {
    return [];
  }
  return bucket.order
    .map(id => bucket.conversationsById[id])
    .filter(
      conversation =>
        conversation &&
        (conversation.messageCount > 0 ||
          conversation.id === normalizedConversationId),
    )
    .map(conversation => ({
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      lastMessagePreview: conversation.lastMessagePreview,
      messageCount: conversation.messageCount,
      pinned: conversation.pinned,
      archived: conversation.archived,
    }));
};

export const selectConversationMessages = (
  state: ChatStoreState,
  conversationId: ConversationId | null,
): ConversationMessage[] => {
  if (!conversationId) {
    return [];
  }
  const bucket = state.byUser[state.activeUserId];
  return bucket?.conversationsById[conversationId]?.messages ?? [];
};

export const getResolvedUserId = (search: string): string => {
  const params = new URLSearchParams(search);
  const queryUserId = params.get('userId') || params.get('user');
  if (queryUserId) {
    return queryUserId;
  }
  if (typeof window === 'undefined') {
    return DEFAULT_USER_ID;
  }
  const storedUserId = window.localStorage.getItem('chat:userId');
  if (storedUserId) {
    return storedUserId;
  }
  return DEFAULT_USER_ID;
};
