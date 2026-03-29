import type { ConversationMessage } from '@/types/session';
import { RobotOutlined } from '@ant-design/icons';
import { Avatar, Typography } from 'antd';
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
            {!isUser && (
              <Avatar
                className="assistant-avatar"
                icon={<RobotOutlined />}
                size={28}
              />
            )}
            <div className={`message-bubble ${isUser ? 'user' : 'assistant'}`}>
              <Typography.Paragraph className="message-text">
                {message.content}
              </Typography.Paragraph>
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
};

export default MessageList;
