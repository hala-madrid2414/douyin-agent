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

export interface ConversationMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
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
