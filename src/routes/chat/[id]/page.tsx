import ChatPage from '@/routes/components/ChatPage';
import { useParams } from '@modern-js/runtime/router';

export default function ChatConversationPage() {
  const params = useParams();
  const conversationIdFromRoute =
    typeof params.id === 'string' ? params.id : null;
  return <ChatPage conversationIdFromRoute={conversationIdFromRoute} />;
}
