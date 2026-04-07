import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';

const SYSTEM_PROMPT = `你是一个专属旅行助手，专门为用户提供专业、贴心的旅行规划和建议。
你可以帮助用户制定行程、推荐景点、解答关于目的地的各种问题。
在回答时，请保持热情、专业，并尽可能提供具体、实用的信息。`;

export const post = async (request: Request) => {
  const data = await request.json();
  const apiKey = process.env.DASHSCOPE_API_KEY || process.env.API_KEY || '';
  const baseURL =
    process.env.LLM_BASE_URL ||
    'https://dashscope.aliyuncs.com/compatible-mode/v1';
  const model = process.env.LLM_MODEL || 'qwen3-max';

  if (!apiKey) {
    return new Response(JSON.stringify({
      code: 500,
      message: 'API key is missing. Please check your .env.local file.',
      data: null,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const chat = new ChatOpenAI({
    openAIApiKey: apiKey,
    configuration: {
      baseURL: baseURL,
    },
    modelName: model,
    streaming: true,
    ...(data.enableThinking ? {
      modelKwargs: {
        enable_thinking: true,
        return_reasoning: true
      }
    } : {})
  });

  try {
    const messages = [
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(data.content),
    ];

    const stream = await chat.stream(messages, { signal: request.signal });

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            // 捕获模型原生的深度思考内容
            if (chunk.additional_kwargs?.reasoning_content) {
              controller.enqueue(encoder.encode(`event: thinking\ndata: ${JSON.stringify({ content: chunk.additional_kwargs.reasoning_content })}\n\n`));
              continue;
            }

            // 捕获正式回复内容
            if (chunk.content) {
              controller.enqueue(encoder.encode(`event: message\ndata: ${JSON.stringify({ content: chunk.content })}\n\n`));
            }
          }

          controller.enqueue(encoder.encode(`event: done\ndata: {"messageId": "m_${Date.now()}"}\n\n`));
          controller.close();
        } catch (e) {
          controller.error(e);
        }
      }
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('LLM API Error:', error);
    return new Response(JSON.stringify({
      code: 500,
      message: 'Failed to generate response from LLM',
      data: null,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
