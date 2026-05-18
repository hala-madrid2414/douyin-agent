/**
 * Task1: SSE 事件契约（最小集合 + error/abort 语义）
 *
 * 说明：
 * - 这里只定义事件名与 payload 结构，后续 Task2/Task4 再逐步接入实际运行时与前端渲染。
 * - 保持兼容：现有前端已消费 thinking/tool_status/message/done；新增 planning/error/abort 为可选扩展。
 */

export const SSE_EVENT_NAMES = [
  'planning',
  'tool_status',
  'thinking',
  'message',
  'done',
  'error',
  'abort',
] as const;

export type SseEventName = (typeof SSE_EVENT_NAMES)[number];

export type ToolStatus = 'start' | 'success' | 'error' | 'abort';

export type PlanningStepStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'error'
  | 'abort';

export type PlanningStep = {
  key: string;
  title: string;
  description?: string;
  status?: PlanningStepStatus;
};

export type PlanningEventPayload = {
  planId: string;
  steps: PlanningStep[];
};

export type ToolStatusEventPayload = {
  tool: string;
  status: ToolStatus;
  title: string;
  detail?: string;
};

export type ThinkingEventPayload = { content: string };
export type MessageEventPayload = { content: string };
export type DoneEventPayload = { messageId: string };

export type ErrorEventPayload = {
  code: string;
  message: string;
};

export type AbortEventPayload = {
  reason?: string;
};

export type SsePayloadByEvent = {
  planning: PlanningEventPayload;
  tool_status: ToolStatusEventPayload;
  thinking: ThinkingEventPayload;
  message: MessageEventPayload;
  done: DoneEventPayload;
  error: ErrorEventPayload;
  abort: AbortEventPayload;
};

/**
 * 格式化为 SSE 帧（event + data + 空行分隔）。
 * 注意：此处只做最小格式化，不做数据校验；数据约束由类型系统与上层逻辑保证。
 */
export const formatSse = <E extends SseEventName>(
  event: E,
  payload: SsePayloadByEvent[E],
): string => {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
};
