import type { ConversationMessage } from '@/types/session';
import {
  CheckCircleFilled,
  ClockCircleOutlined,
  CopyOutlined,
  DislikeOutlined,
  ExclamationCircleOutlined,
  LikeOutlined,
  MinusCircleFilled,
  SyncOutlined,
} from '@ant-design/icons';
import { CodeHighlighter, Mermaid, Think, ThoughtChain } from '@ant-design/x';
import { XMarkdown } from '@ant-design/x-markdown';
import { Button, Space, Typography, message as antMessage } from 'antd';
import type React from 'react';
import { useEffect, useRef } from 'react';
import './MessageList.less';

export interface MessageListProps {
  messages: ConversationMessage[];
  onRetry?: (
    content: string,
    options?: { enableThinking?: boolean; forceToolCall?: boolean },
  ) => void;
}

const MessageList: React.FC<MessageListProps> = ({ messages, onRetry }) => {
  const endRef = useRef<HTMLDivElement | null>(null);
  type MarkdownCodeProps = {
    lang?: string;
    children?: React.ReactNode;
    block?: boolean;
  };
  type MarkdownPreProps = {
    children?: React.ReactNode;
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  });

  const markdownComponents = {
    code: (props: MarkdownCodeProps) => {
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
    pre: (props: MarkdownPreProps) => (
      <div className="markdown-pre-wrapper">{props.children}</div>
    ),
  };

  const handleFeedback = () => {
    antMessage.success('收到反馈');
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      antMessage.success('复制成功');
    });
  };

  const handleRetry = (
    currentIndex: number,
    options?: { forceToolCall?: boolean },
  ) => {
    if (!onRetry) return;
    // Look backwards from the current message index to find the last user message
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        onRetry(messages[i].content, options);
        return;
      }
    }
  };

  const getFallbackToolDescription = (
    key: string,
    status: 'loading' | 'success' | 'error' | 'abort',
  ): string => {
    const toolName = key.toLowerCase() === 'qweather' ? '天气工具' : '联网工具';
    if (status === 'loading') return `${toolName}执行中`;
    if (status === 'success') return `${toolName}执行成功`;
    if (status === 'error') return `${toolName}执行失败，已降级`;
    return `${toolName}已中止`;
  };

  const getFallbackThoughtDescription = (
    nodeType: 'planning' | 'tool',
    key: string,
    status: 'loading' | 'success' | 'error' | 'abort',
  ): string => {
    if (nodeType === 'planning') {
      if (status === 'loading') return '步骤进行中';
      if (status === 'success') return '步骤完成';
      if (status === 'error') return '步骤异常';
      return '步骤中止';
    }
    return getFallbackToolDescription(key, status);
  };

  const getThoughtNodeTypeLabel = (nodeType: 'planning' | 'tool'): string => {
    return nodeType === 'planning' ? '规划节点' : '工具节点';
  };

  return (
    <div className="message-list" data-testid="message-list">
      {messages.map((message, index) => {
        const isUser = message.role === 'user';
        const isLoading = message.status === 'loading';
        const isAborted = message.status === 'aborted';
        const isComplete = message.status === 'complete';
        const isError = message.status === 'error';
        const hasContent = Boolean(message.content);
        const hasThinking = Boolean(message.thinkingContent);
        const hasThoughtChain = Boolean(message.thoughtChain?.length);
        const hasToolTrace = Boolean(
          message.thoughtChain?.some(node => node.type === 'tool'),
        );
        const thoughtChainItems =
          [...(message.thoughtChain ?? [])]
            .sort((left, right) => left.order - right.order)
            .map((node, nodeIndex) => ({
              key: `${message.id}-${node.key}-${nodeIndex}`,
              title: (
                <div className="thought-chain-node-title">
                  <span className="thought-chain-node-type">
                    {getThoughtNodeTypeLabel(node.type)}
                  </span>
                  <span className="thought-chain-node-main-title">
                    {node.title}
                  </span>
                </div>
              ),
              description: (
                <div className="thought-chain-node-description">
                  {node.description ||
                    getFallbackThoughtDescription(node.type, node.key, node.status)}
                </div>
              ),
              status: node.status,
              collapsible: true,
              className: `thought-chain-node thought-chain-node-${node.status}`,
              icon:
                node.status === 'loading' ? (
                  <ClockCircleOutlined />
                ) : node.status === 'error' ? (
                  <ExclamationCircleOutlined />
                ) : node.status === 'success' ? (
                  <CheckCircleFilled />
                ) : node.status === 'abort' ? (
                  <MinusCircleFilled />
                ) : undefined,
            })) ?? [];
        const defaultExpandedKeys = thoughtChainItems
          .filter(item => item.status === 'loading')
          .map(item => item.key);

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
                    <div className="loading-placeholder">
                      <span className="dot-pulse">正在为你规划旅行</span>
                    </div>
                  ) : hasThinking ? (
                    <Think
                      loading={isLoading && !hasContent}
                      title={
                        isLoading && !hasContent ? '深度思考中…' : '思考完毕'
                      }
                      defaultExpanded={false}
                    >
                      <XMarkdown components={markdownComponents}>
                        {message.thinkingContent}
                      </XMarkdown>
                    </Think>
                  ) : null}
                  {hasContent && (
                    <XMarkdown components={markdownComponents}>
                      {message.content}
                    </XMarkdown>
                  )}
                  {hasThoughtChain && (
                    <div className="tool-thought-chain thought-chain-panel">
                      <ThoughtChain
                        items={thoughtChainItems}
                        line="dashed"
                        defaultExpandedKeys={defaultExpandedKeys}
                        classNames={{
                          root: 'thought-chain-root',
                          item: 'thought-chain-item',
                          itemIcon: 'thought-chain-item-icon',
                          itemHeader: 'thought-chain-item-header',
                          itemContent: 'thought-chain-item-content',
                        }}
                        styles={{
                          root: {
                            width: '100%',
                          },
                          itemHeader: {
                            alignItems: 'flex-start',
                          },
                        }}
                      />
                    </div>
                  )}
                  {(isComplete || isAborted || isError) && (
                    <div className="assistant-message-footer">
                      <div
                        className={`message-status ${isError ? 'error' : isAborted ? 'aborted' : 'complete'}`}
                      >
                        {isComplete ? (
                          <>
                            <CheckCircleFilled className="status-icon" />{' '}
                            任务完成
                          </>
                        ) : isError ? (
                          <>
                            <ExclamationCircleOutlined className="status-icon" />{' '}
                            生成失败
                          </>
                        ) : (
                          <>
                            <MinusCircleFilled className="status-icon" />{' '}
                            已手动终止
                          </>
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
                          onClick={() =>
                            handleRetry(index, { forceToolCall: true })
                          }
                          title={hasToolTrace ? '重查工具' : '重试'}
                          style={{ display: hasToolTrace ? undefined : 'none' }}
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
