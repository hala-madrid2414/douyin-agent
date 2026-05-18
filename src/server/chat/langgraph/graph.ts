/**
 * Task1: LangGraph 对话执行图的静态规格（节点与边）
 *
 * 说明：
 * - 这里只描述“应当存在的”节点与边；Task2 再将其绑定到具体 LangGraph Runtime。
 * - 节点命名优先可读与稳定（便于 SSE planning / 前端 ThoughtChain 对齐）。
 */

export const CHAT_GRAPH_NODES = {
  planner: 'planner',
  tool_selector: 'tool_selector',
  tool_exec: 'tool_exec',
  aggregator: 'aggregator',
  responder: 'responder',
} as const;

export type ChatGraphNodeId =
  (typeof CHAT_GRAPH_NODES)[keyof typeof CHAT_GRAPH_NODES];

export type ChatGraphEdge = {
  from: ChatGraphNodeId;
  to: ChatGraphNodeId;
  /**
   * 可选的边条件描述（用于规划/分支语义对齐）。
   * 例如：has_tools / no_tools / tool_failed 等。
   */
  when?: string;
};

export const edges: readonly ChatGraphEdge[] = [
  // 规划：产出意图、工具候选、并行策略等
  { from: 'planner', to: 'tool_selector' },
  // 工具选择：决定调用哪些工具（0/1/2...）
  { from: 'tool_selector', to: 'tool_exec', when: 'has_tools' },
  { from: 'tool_selector', to: 'aggregator', when: 'no_tools' },
  // 并行工具执行：实际调用外部工具（未来支持多工具并行）
  { from: 'tool_exec', to: 'aggregator' },
  // 结果汇总：整合工具返回、降级/容错、形成回答上下文
  { from: 'aggregator', to: 'responder' },
  // 输出：生成最终回答（流式 message + done）
  { from: 'responder', to: 'responder', when: 'streaming_chunks' },
] as const;

export const chatGraphSpec = {
  nodes: CHAT_GRAPH_NODES,
  edges,
} as const;
