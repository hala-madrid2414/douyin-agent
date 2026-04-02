import type { ConversationMessage } from '@/types/session';
import { Think, CodeHighlighter, Mermaid } from '@ant-design/x';
import { XMarkdown } from '@ant-design/x-markdown';
import { Button, Space, Typography, message as antMessage } from 'antd';
import {
  CheckCircleFilled,
  CopyOutlined,
  DislikeOutlined,
  LikeOutlined,
  MinusCircleFilled,
  SyncOutlined,
} from '@ant-design/icons';
import type React from 'react';
import { useEffect, useRef } from 'react';
import './MessageList.less';

export interface MessageListProps {
  messages: ConversationMessage[];
  onRetry?: (content: string) => void;
}

const MessageList: React.FC<MessageListProps> = ({ messages, onRetry }) => {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  });

  const markdownComponents = {
    code: (props: any) => {
      const { lang, children, block } = props;
      const codeContent = String(children);
      
      if (block) {
        if (lang === 'mermaid') {
          return <Mermaid>{codeContent}</Mermaid>;
        }
        return <CodeHighlighter lang={lang}>{codeContent}</CodeHighlighter>;
      }
      return <code className="inline-code">{children}</code>;
    },
    pre: (props: any) => <div className="markdown-pre-wrapper">{props.children}</div>,
  };

  const handleFeedback = () => {
    antMessage.success('收到反馈');
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      antMessage.success('复制成功');
    });
  };

  const handleRetry = (currentIndex: number) => {
    if (!onRetry) return;
    // Look backwards from the current message index to find the last user message
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        onRetry(messages[i].content);
        return;
      }
    }
  };

  return (
    <div className="message-list" data-testid="message-list">
      {messages.map((message, index) => {
        const isUser = message.role === 'user';
        const isLoading = message.status === 'loading';
        const isAborted = message.status === 'aborted';
        const isComplete = message.status === 'complete';
        const hasContent = Boolean(message.content);
        const hasThinking = Boolean(message.thinkingContent);

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
                <div className="assistant-message-content">
                  {isLoading && !hasContent && !hasThinking ? (
                    <Think loading title="正在为你规划旅行…" />
                  ) : hasThinking ? (
                    <Think
                      loading={isLoading && !hasContent}
                      title={isLoading && !hasContent ? '深入思考中…' : '思考完毕'}
                      defaultExpanded={false}
                    >
                      <XMarkdown
                        components={markdownComponents}
                        children={message.thinkingContent}
                      />
                    </Think>
                  ) : null}
                  {hasContent && (
                    <XMarkdown components={markdownComponents} children={message.content} />
                  )}
                  {(isComplete || isAborted) && (
                    <div className="assistant-message-footer">
                      <div className={`message-status ${isAborted ? 'aborted' : 'complete'}`}>
                        {isComplete ? (
                          <><CheckCircleFilled className="status-icon" /> 任务完成</>
                        ) : (
                          <><MinusCircleFilled className="status-icon" /> 已手动终止</>
                        )}
                      </div>
                      <Space size={4} className="message-actions">
                        <Button
                          type="text"
                          size="small"
                          icon={<LikeOutlined />}
                          onClick={handleFeedback}
                          title="赞"
                        />
                        <Button
                          type="text"
                          size="small"
                          icon={<DislikeOutlined />}
                          onClick={handleFeedback}
                          title="踩"
                        />
                        <Button
                          type="text"
                          size="small"
                          icon={<CopyOutlined />}
                          onClick={() => handleCopy(message.content)}
                          title="复制"
                        />
                        <Button
                          type="text"
                          size="small"
                          icon={<SyncOutlined />}
                          onClick={() => handleRetry(index)}
                          title="重试"
                        />
                      </Space>
                    </div>
                  )}
                </div>
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
