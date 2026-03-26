import type { ChatMessage } from '@/constants/chat';
import { RobotOutlined } from '@ant-design/icons';
import { Avatar, Typography } from 'antd';
import React, { useEffect, useRef } from 'react';
import './MessageList.less';

export interface MessageListProps {
  messages: ChatMessage[];
}

const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages.length]);

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
