import type { ConversationMessage } from '@/types/session';
import { XMarkdown } from '@ant-design/x-markdown';
import { Typography } from 'antd';
import type React from 'react';
import { useEffect, useRef } from 'react';
import './MessageList.less';

export interface MessageListProps {
  messages: ConversationMessage[];
}

const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  });

  return (
    <div className="message-list" data-testid="message-list">
      {messages.map(message => {
        const isUser = message.role === 'user';
        return (
          <div
            key={message.id}
            className={`message-row ${isUser ? 'user' : 'assistant'}`}
          >
            <div className={`message-bubble ${isUser ? 'user' : 'assistant'}`}>
              {isUser ? (
                <Typography.Paragraph className="message-text">
                  {message.content}
                </Typography.Paragraph>
              ) : (
                <XMarkdown children={message.content} />
              )}
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
};

export default MessageList;
