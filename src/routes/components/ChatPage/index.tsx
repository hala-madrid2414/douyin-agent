import InputArea from '@/routes/components/InputArea';
import MessageList from '@/routes/components/MessageList';
import Sidebar from '@/routes/components/Sidebar';
import WelcomeView from '@/routes/components/WelcomeView';
import { getResolvedUserId, useChatStore } from '@/stores/chatStore';
import type { ConversationSummary } from '@/types/session';
import { isConversationId } from '@/utils/conversationId';
import { useLocation, useNavigate } from '@modern-js/runtime/router';
import { Modal } from 'antd';
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
  const sendMessage = useChatStore(state => state.sendMessage);

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
    const seenIds = new Set<string>();
    return activeBucket.order
      .filter(id => {
        if (seenIds.has(id)) {
          return false;
        }
        seenIds.add(id);
        return true;
      })
      .map(id => activeBucket.conversationsById[id])
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
  }, [activeBucket, normalizedConversationId]);
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
    const targetPath = `/chat/${conversationId}${querySuffix}`;
    if (`${location.pathname}${location.search}` === targetPath) {
      return;
    }
    navigate(targetPath);
  };

  const handleNewChat = () => {
    if (!normalizedConversationId) {
      return;
    }
    const targetPath = `/${querySuffix}`;
    if (`${location.pathname}${location.search}` === targetPath) {
      return;
    }
    navigate(targetPath);
  };

  const handleSend = (content: string) => {
    let targetConversationId = normalizedConversationId;
    if (!targetConversationId) {
      targetConversationId = createConversation();
      const targetPath = `/chat/${targetConversationId}${querySuffix}`;
      if (`${location.pathname}${location.search}` !== targetPath) {
        navigate(targetPath);
      }
    }
    sendMessage(targetConversationId, content);
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
