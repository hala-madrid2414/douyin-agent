import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';

const SYSTEM_PROMPT = `你是一个专属旅行助手，专门为用户提供专业、贴心的旅行规划和建议。
你可以帮助用户制定行程、推荐景点、解答关于目的地的各种问题。
在回答时，请保持热情、专业，并尽可能提供具体、实用的信息。`;

type TavilySearchResult = {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
};

type ToolStatus = 'start' | 'success' | 'error' | 'abort';

interface ChatRequestData {
  content?: string;
  enableThinking?: boolean;
  forceToolCall?: boolean;
}

const REALTIME_HINT_PATTERNS = [
  /今天|明天|后天|这周|本周|当前|现在|最近|实时|最新/,
  /天气|温度|降雨|台风|空气质量/,
  /开放|营业|闭园|关门|排队|人流|拥挤|预约|门票/,
];

const DEFAULT_TAVILY_URL = 'https://api.tavily.com/search';

const shouldUseRealtimeTool = (query: string): boolean => {
  const normalized = query.trim();
  if (!normalized) {
    return false;
  }
  return REALTIME_HINT_PATTERNS.some(pattern => pattern.test(normalized));
};

const sanitizeForPrompt = (text: string, max = 700): string => {
  return text.replace(/\s+/g, ' ').trim().slice(0, max);
};

const maskSensitiveError = (error: unknown): string => {
  if (error instanceof Error) {
    const message = error.message || 'unknown_error';
    return message.replace(/[A-Za-z0-9_-]{20,}/g, '***');
  }
  return 'unknown_error';
};

const fetchTavilyWithRetry = async (
  query: string,
): Promise<TavilySearchResult[]> => {
  const apiKey = process.env.TAVILY_API_KEY || '';
  if (!apiKey) {
    throw new Error('TAVILY_API_KEY is missing');
  }

  const endpoint = process.env.TAVILY_API_URL || DEFAULT_TAVILY_URL;
  const maxResults = Number(process.env.TAVILY_SEARCH_MAX_RESULTS || 5);
  const timeoutMs = Number(process.env.TOOL_CALL_TIMEOUT || 10000);
  const maxRetry = Number(process.env.TAVILY_RETRY_TIMES || 1);

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= maxRetry; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          include_answer: false,
          search_depth: 'basic',
          max_results: maxResults,
          topic: 'general',
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`tavily_http_${response.status}`);
      }

      const json = await response.json();
      const rows: TavilySearchResult[] = Array.isArray(json?.results)
        ? json.results
        : [];
      return rows.slice(0, maxResults);
    } catch (error) {
      lastError = error;
      if (attempt >= maxRetry) {
        break;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('tavily_failed');
};

const formatToolContext = (results: TavilySearchResult[]): string => {
  if (results.length === 0) {
    return '未检索到可靠的实时结果。';
  }

  const lines = results.map((item, index) => {
    const title = sanitizeForPrompt(item.title || '未命名来源', 80);
    const content = sanitizeForPrompt(item.content || '', 220);
    const url = sanitizeForPrompt(item.url || '', 120);
    return `${index + 1}. ${title}\n内容: ${content || '无摘要'}\n来源: ${url || '未知'}`;
  });

  return lines.join('\n');
};

export const post = async ({
  data,
  request,
}: { data: ChatRequestData; request: Request }) => {
  const apiKey = process.env.DASHSCOPE_API_KEY || process.env.API_KEY || '';
  const baseURL =
    process.env.LLM_BASE_URL ||
    'https://dashscope.aliyuncs.com/compatible-mode/v1';
  const model = process.env.LLM_MODEL || 'qwen3-max';

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        code: 500,
        message: 'API key is missing. Please check your .env.local file.',
        data: null,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  const chat = new ChatOpenAI({
    openAIApiKey: apiKey,
    configuration: {
      baseURL: baseURL,
    },
    modelName: model,
    streaming: true,
    ...(data.enableThinking
      ? {
          modelKwargs: {
            enable_thinking: true,
            return_reasoning: true,
          },
        }
      : {}),
  });

  try {
    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        let isClosed = false;
        let isAborted = false;

        const safeClose = () => {
          if (isClosed) {
            return;
          }
          try {
            controller.close();
          } catch {
            // ignore close race
          } finally {
            isClosed = true;
          }
        };

        const safeEmitSse = (
          event: string,
          payload: Record<string, unknown>,
        ): boolean => {
          if (isClosed) {
            return false;
          }
          try {
            controller.enqueue(
              encoder.encode(
                `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`,
              ),
            );
            return true;
          } catch (error) {
            if (
              error instanceof Error &&
              (error as { code?: string }).code === 'ERR_INVALID_STATE'
            ) {
              isClosed = true;
              return false;
            }
            throw error;
          }
        };

        const emitToolStatus = (status: ToolStatus, detail?: string) => {
          safeEmitSse('tool_status', {
            tool: 'tavily',
            status,
            title: '联网旅行信息查询',
            detail: detail || '',
          });
        };

        try {
          const query = String(data?.content || '');
          const forceToolCall = Boolean(data?.forceToolCall);
          const shouldCallTool = forceToolCall || shouldUseRealtimeTool(query);
          let toolContext = '';
          let toolFailed = false;

          if (shouldCallTool) {
            emitToolStatus('start', '正在联网检索实时旅行信息');
            try {
              const results = await fetchTavilyWithRetry(query);
              toolContext = formatToolContext(results);
              emitToolStatus(
                'success',
                results.length > 0
                  ? `已检索到 ${results.length} 条候选信息`
                  : '未检索到高置信结果',
              );
            } catch (error) {
              toolFailed = true;
              console.error('Tavily tool failed:', maskSensitiveError(error));
              emitToolStatus('error', '工具调用失败，已切换为基础建议模式');
            }
          }

          let finalSystemPrompt = SYSTEM_PROMPT;
          if (toolContext) {
            finalSystemPrompt += `\n\n以下是联网检索到的参考资料，请仅提取与用户问题相关且可信的信息，不要暴露原始JSON。\n${toolContext}`;
          }
          if (toolFailed) {
            finalSystemPrompt +=
              '\n\n联网工具暂不可用，请在回答开头说明“暂时无法获取实时信息，为你提供基础建议”，然后继续给出有用建议。';
          }

          const messages = [
            new SystemMessage(finalSystemPrompt),
            new HumanMessage(query),
          ];

          const stream = await chat.stream(messages);

          for await (const chunk of stream) {
            if (request?.signal?.aborted) {
              isAborted = true;
              emitToolStatus('abort', '请求已中止');
              break;
            }

            // 捕获模型原生的深度思考内容
            if (chunk.additional_kwargs?.reasoning_content) {
              safeEmitSse('thinking', {
                content: chunk.additional_kwargs.reasoning_content,
              });
              continue;
            }

            // 捕获正式回复内容
            if (chunk.content) {
              safeEmitSse('message', { content: chunk.content });
            }
          }

          if (!isAborted) {
            safeEmitSse('done', { messageId: `m_${Date.now()}` });
          }
          safeClose();
        } catch (e) {
          console.error('Stream generation error:', e);
          const abortedByError = e instanceof Error && e.name === 'AbortError';
          if (abortedByError || isAborted) {
            safeClose();
            return;
          }
          safeEmitSse('message', {
            content: '暂时无法为你规划行程，请稍后重试',
          });
          safeEmitSse('done', { messageId: `m_${Date.now()}` });
          safeClose();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('LLM API Error:', error);
    return new Response(
      JSON.stringify({
        code: 500,
        message: 'Failed to generate response from LLM',
        data: null,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
};
