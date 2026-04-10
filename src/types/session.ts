export type ConversationId = string;

export type ChatMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export type ChatMessageStatus =
  | 'sending'
  | 'streaming'
  | 'failed'
  | 'aborted'
  | 'complete'
  | 'loading'
  | 'error';

export type ToolCallStatus = 'loading' | 'success' | 'error' | 'abort';

export type ThoughtChainNodeType = 'planning' | 'tool';

export interface ThoughtChainNode {
  key: string;
  type: ThoughtChainNodeType;
  order: number;
  title: string;
  description?: string;
  status: ToolCallStatus;
  planId?: string;
  toolCallId?: string;
}

export interface ToolCallTrace {
  key: string;
  title: string;
  description?: string;
  status: ToolCallStatus;
}

export interface ConversationMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  thinkingContent?: string;
  thoughtChain?: ThoughtChainNode[];
  toolTrace?: ToolCallTrace[];
  createdAt: string;
  status?: ChatMessageStatus;
  model?: string;
}

export interface ConversationSummary {
  id: ConversationId;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessagePreview: string;
  messageCount: number;
  pinned?: boolean;
  archived?: boolean;
}

export interface ConversationEntity extends ConversationSummary {
  messages: ConversationMessage[];
}
