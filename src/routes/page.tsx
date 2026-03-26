import Sidebar from './components/Sidebar';
import WelcomeView from './components/WelcomeView';
import InputArea from './components/InputArea';
import MessageList from './components/MessageList';
import {
  MOCK_CHAT_SESSIONS,
  STATIC_AI_REPLY,
  type ChatMessage,
  type ChatSession,
} from '@/constants/chat';
import { useMemo, useRef, useState } from 'react';
import './index.less';

export default function Index() {
  const initialSessionMap = useMemo(() => {
    return Object.fromEntries(
      MOCK_CHAT_SESSIONS.map(session => [session.id, session]),
    ) as Record<string, ChatSession>;
  }, []);

  const [sessionMap, setSessionMap] =
    useState<Record<string, ChatSession>>(initialSessionMap);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [newChatMessages, setNewChatMessages] = useState<ChatMessage[]>([]);
  const messageSeqRef = useRef(1);

  const currentMessages = activeSessionId
    ? (sessionMap[activeSessionId]?.messages ?? [])
    : newChatMessages;

  const handleSend = (content: string) => {
    const seq = messageSeqRef.current++;
    const userMessage: ChatMessage = {
      id: `${activeSessionId ?? 'new'}-user-${Date.now()}-${seq}`,
      role: 'user',
      content,
    };
    const assistantMessage: ChatMessage = {
      id: `${activeSessionId ?? 'new'}-assistant-${Date.now()}-${seq}`,
      role: 'assistant',
      content: STATIC_AI_REPLY,
    };

    if (activeSessionId) {
      setSessionMap(prev => {
        const session = prev[activeSessionId];
        if (!session) return prev;
        return {
          ...prev,
          [activeSessionId]: {
            ...session,
            messages: [...session.messages, userMessage, assistantMessage],
          },
        };
      });
      return;
    }

    setNewChatMessages(prev => [...prev, userMessage, assistantMessage]);
  };

  return (
    <div className="app-container">
      <Sidebar
        activeId={activeSessionId}
        onSelectSession={setActiveSessionId}
        onNewChat={() => {
          setActiveSessionId(null);
          setNewChatMessages([]);
        }}
      />
      <div className="main-content">
        <div className="content-scroll-area">
          {currentMessages.length === 0 ? (
            <WelcomeView />
          ) : (
            <MessageList messages={currentMessages} />
          )}
        </div>
        <div className="input-area-wrapper">
          <InputArea onSend={handleSend} />
        </div>
      </div>
    </div>
  );
}
