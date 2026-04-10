import type {
  PlanningStep,
  SseEventName,
  SsePayloadByEvent,
  ToolStatus,
} from './contract';

type ToolKey = 'tavily' | 'qweather';

type RuntimeChunk = {
  content?: string;
  additional_kwargs?: {
    reasoning_content?: string;
  };
};

type RuntimeDeps = {
  query: string;
  forceToolCall: boolean;
  systemPrompt: string;
  requestSignal?: AbortSignal;
  shouldUseWeatherTool: (query: string) => boolean;
  shouldUseRealtimeTool: (query: string) => boolean;
  shouldUseNonWeatherRealtimeTool: (query: string) => boolean;
  runQWeatherNode: (query: string) => Promise<string>;
  runTavilyNode: (query: string) => Promise<string>;
  maskSensitiveError: (error: unknown) => string;
  streamModel: (
    query: string,
    finalSystemPrompt: string,
  ) => Promise<AsyncIterable<RuntimeChunk>>;
  emitSse: <E extends SseEventName>(
    event: E,
    payload: SsePayloadByEvent[E],
  ) => boolean;
  emitToolStatus: (tool: ToolKey, status: ToolStatus, detail?: string) => void;
};

const createPlanId = () => `plan_${Date.now()}`;

const buildAggregatedSystemPrompt = ({
  systemPrompt,
  weatherContext,
  toolContext,
  weatherFailed,
  toolFailed,
}: {
  systemPrompt: string;
  weatherContext: string;
  toolContext: string;
  weatherFailed: boolean;
  toolFailed: boolean;
}): string => {
  let finalSystemPrompt = systemPrompt;
  if (weatherContext) {
    finalSystemPrompt += `\n\n以下是和风天气返回的标准化上下文，请优先使用与用户问题最相关的数据点，避免虚构。\n${weatherContext}`;
  }
  if (toolContext) {
    finalSystemPrompt += `\n\n以下是联网检索到的参考资料，请仅提取与用户问题相关且可信的信息，不要暴露原始JSON。\n${toolContext}`;
  }
  if (toolFailed || weatherFailed) {
    finalSystemPrompt +=
      '\n\n部分联网工具暂不可用，请在回答开头说明“暂时无法获取完整实时信息，为你提供基础建议”，然后继续给出有用建议。';
  }
  return finalSystemPrompt;
};

export const runChatLangGraphRuntime = async (
  deps: RuntimeDeps,
): Promise<void> => {
  const {
    query,
    forceToolCall,
    systemPrompt,
    requestSignal,
    shouldUseWeatherTool,
    shouldUseRealtimeTool,
    shouldUseNonWeatherRealtimeTool,
    runQWeatherNode,
    runTavilyNode,
    maskSensitiveError,
    streamModel,
    emitSse,
    emitToolStatus,
  } = deps;

  const planId = createPlanId();
  const planningSteps: PlanningStep[] = [
    { key: 'planner', title: '意图规划', status: 'running' as const },
    { key: 'tool_selector', title: '工具选择', status: 'pending' as const },
    { key: 'tool_exec', title: '工具执行', status: 'pending' as const },
    { key: 'aggregator', title: '结果整合', status: 'pending' as const },
    { key: 'responder', title: '流式回答', status: 'pending' as const },
  ];
  emitSse('planning', { planId, steps: planningSteps });
  planningSteps[0].status = 'success';
  planningSteps[1].status = 'running';
  emitSse('planning', { planId, steps: planningSteps });

  const hasWeatherIntent = shouldUseWeatherTool(query);
  const hasRealtimeIntent = shouldUseRealtimeTool(query);
  const hasNonWeatherRealtimeIntent = shouldUseNonWeatherRealtimeTool(query);

  const selectedTools: ToolKey[] = [];
  if (hasWeatherIntent) {
    selectedTools.push('qweather');
  }
  const shouldUseTavily =
    forceToolCall ||
    hasNonWeatherRealtimeIntent ||
    (!hasWeatherIntent && hasRealtimeIntent);
  if (shouldUseTavily) {
    selectedTools.push('tavily');
  }

  planningSteps[1].status = 'success';
  planningSteps[2].status = 'running';
  emitSse('planning', { planId, steps: planningSteps });

  let weatherContext = '';
  let toolContext = '';
  let weatherFailed = false;
  let toolFailed = false;

  const runToolSerially = async (tool: ToolKey) => {
    try {
      if (tool === 'qweather') {
        emitToolStatus('qweather', 'start', '正在查询目的地天气信息');
        const context = await runQWeatherNode(query);
        emitToolStatus('qweather', 'success', '已完成 now/24h/3d/7d 天气整合');
        return { tool, context };
      }

      const detail =
        hasWeatherIntent && hasNonWeatherRealtimeIntent
          ? '正在联网检索景点开放等实时信息'
          : '正在联网检索实时旅行信息';
      emitToolStatus('tavily', 'start', detail);
      const context = await runTavilyNode(query);
      emitToolStatus(
        'tavily',
        'success',
        context && context !== '未检索到可靠的实时结果。'
          ? '已检索到候选信息'
          : '未检索到高置信结果',
      );
      return { tool, context };
    } catch (error) {
      const message = maskSensitiveError(error);
      if (tool === 'qweather') {
        weatherFailed = true;
        emitToolStatus('qweather', 'error', '天气工具调用失败，已切换为基础建议模式');
      } else {
        toolFailed = true;
        emitToolStatus('tavily', 'error', '工具调用失败，已切换为基础建议模式');
      }
      console.error('LangGraph tool execution failed:', { tool, message });
      return { tool, context: '' };
    }
  };

  const observedTools: ToolKey[] = [];
  const decideNextTool = (): ToolKey | null => {
    if (selectedTools.includes('qweather') && !observedTools.includes('qweather')) {
      return 'qweather';
    }
    if (selectedTools.includes('tavily') && !observedTools.includes('tavily')) {
      const shouldContinueWithTavily =
        !hasWeatherIntent ||
        hasNonWeatherRealtimeIntent ||
        forceToolCall ||
        weatherFailed ||
        Boolean(weatherContext);
      if (shouldContinueWithTavily) {
        return 'tavily';
      }
    }
    return null;
  };

  let nextTool = decideNextTool();
  while (nextTool) {
    emitSse('thinking', {
      content:
        nextTool === 'qweather'
          ? '先调用天气工具获取目的地天气事实，再决定是否需要联网补充信息。'
          : '基于当前观察结果，继续调用联网工具补充实时信息。',
    });
    const result = await runToolSerially(nextTool);
    observedTools.push(nextTool);
    if (result.tool === 'qweather') {
      weatherContext = result.context;
    } else {
      toolContext = result.context;
    }
    emitSse('thinking', {
      content:
        nextTool === 'qweather'
          ? '已观察天气结果，继续判断是否需要进行联网检索。'
          : '已观察联网结果，准备汇总并生成最终回答。',
    });
    nextTool = decideNextTool();
  }

  planningSteps[2].status = toolFailed || weatherFailed ? 'error' : 'success';
  planningSteps[3].status = 'running';
  emitSse('planning', { planId, steps: planningSteps });

  const finalSystemPrompt = buildAggregatedSystemPrompt({
    systemPrompt,
    weatherContext,
    toolContext,
    weatherFailed,
    toolFailed,
  });

  planningSteps[3].status = 'success';
  planningSteps[4].status = 'running';
  emitSse('planning', { planId, steps: planningSteps });

  const stream = await streamModel(query, finalSystemPrompt);
  for await (const chunk of stream) {
    if (requestSignal?.aborted) {
      emitToolStatus('tavily', 'abort', '请求已中止');
      emitToolStatus('qweather', 'abort', '请求已中止');
      emitSse('abort', { reason: 'request_aborted' });
      planningSteps[4].status = 'abort';
      emitSse('planning', { planId, steps: planningSteps });
      return;
    }

    if (chunk.additional_kwargs?.reasoning_content) {
      emitSse('thinking', {
        content: chunk.additional_kwargs.reasoning_content,
      });
      continue;
    }

    if (chunk.content) {
      emitSse('message', { content: chunk.content });
    }
  }

  planningSteps[4].status = 'success';
  emitSse('planning', { planId, steps: planningSteps });
  emitSse('done', { messageId: `m_${Date.now()}` });
};
