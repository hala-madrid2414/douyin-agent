import InputArea from '@/routes/components/InputArea';
import MessageList from '@/routes/components/MessageList';
import Sidebar from '@/routes/components/Sidebar';
import WelcomeView from '@/routes/components/WelcomeView';
import { getResolvedUserId, useChatStore } from '@/stores/chatStore';
import type { ConversationSummary } from '@/types/session';
import { isConversationId } from '@/utils/conversationId';
import { useLocation, useNavigate } from '@modern-js/runtime/router';
import { useEffect, useMemo } from 'react';
import '../../index.less';

export interface ChatPageProps {
  conversationIdFromRoute: string | null;
}

const ChatPage = ({ conversationIdFromRoute }: ChatPageProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const activeUserId = useChatStore(state => state.activeUserId);
  const byUser = useChatStore(state => state.byUser);
  const setActiveUser = useChatStore(state => state.setActiveUser);
  const createConversation = useChatStore(state => state.createConversation);
  const ensureConversation = useChatStore(state => state.ensureConversation);
  const sendMockConversationTurn = useChatStore(
    state => state.sendMockConversationTurn,
  );

  const resolvedUserId = useMemo(
    () => getResolvedUserId(location.search),
    [location.search],
  );
  const querySuffix = location.search || '';
  const normalizedConversationId = useMemo(() => {
    if (
      !conversationIdFromRoute ||
      !isConversationId(conversationIdFromRoute)
    ) {
      return null;
    }
    return conversationIdFromRoute;
  }, [conversationIdFromRoute]);
  const activeBucket = useMemo(
    () => byUser[activeUserId],
    [activeUserId, byUser],
  );
  const summaries = useMemo((): ConversationSummary[] => {
    if (!activeBucket) {
      return [];
    }
    return activeBucket.order
      .map(id => activeBucket.conversationsById[id])
      .filter(Boolean)
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
  }, [activeBucket]);
  const messages = useMemo(() => {
    if (!activeBucket || !normalizedConversationId) {
      return [];
    }
    return (
      activeBucket.conversationsById[normalizedConversationId]?.messages ?? []
    );
  }, [activeBucket, normalizedConversationId]);

  useEffect(() => {
    if (resolvedUserId !== activeUserId) {
      setActiveUser(resolvedUserId);
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('chat:userId', resolvedUserId);
    }
  }, [activeUserId, resolvedUserId, setActiveUser]);

  useEffect(() => {
    if (!conversationIdFromRoute) {
      return;
    }
    if (!normalizedConversationId) {
      navigate(`/${querySuffix}`, { replace: true });
      return;
    }
    ensureConversation(normalizedConversationId);
  }, [
    conversationIdFromRoute,
    ensureConversation,
    navigate,
    normalizedConversationId,
    querySuffix,
  ]);

  const handleSelectSession = (conversationId: string) => {
    navigate(`/chat/${conversationId}${querySuffix}`);
  };

  const handleNewChat = () => {
    const nextId = createConversation();
    navigate(`/chat/${nextId}${querySuffix}`);
  };

  const handleSend = (content: string) => {
    const targetConversationId =
      normalizedConversationId ?? createConversation();
    if (!normalizedConversationId) {
      navigate(`/chat/${targetConversationId}${querySuffix}`);
    }
    sendMockConversationTurn(targetConversationId, content);
  };

  return (
    <div className="app-container">
      <Sidebar
        activeId={normalizedConversationId}
        sessions={summaries.map(summary => ({
          id: summary.id,
          title: summary.title,
          updatedAt: summary.updatedAt,
        }))}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
      />
      <div className="main-content">
        <div className="content-scroll-area">
          {messages.length === 0 ? (
            <WelcomeView />
          ) : (
            <MessageList messages={messages} />
          )}
        </div>
        <div className="input-area-wrapper">
          <InputArea onSend={handleSend} />
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
