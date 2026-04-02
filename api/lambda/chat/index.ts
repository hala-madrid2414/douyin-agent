import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';

const SYSTEM_PROMPT = `你是一个专属旅行助手，专门为用户提供专业、贴心的旅行规划和建议。
你可以帮助用户制定行程、推荐景点、解答关于目的地的各种问题。
在回答时，请保持热情、专业，并尽可能提供具体、实用的信息。`;

export const post = async ({
  data,
}: { data: { conversationId: string; content: string } }) => {
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
  });

  try {
    const messages = [
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(data.content),
    ];

    const stream = await chat.stream(messages);

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          let buffer = '';
          let isThinking = false;
          let thinkTagMatched = false;

          for await (const chunk of stream) {
            // Support native reasoning_content if model provides it
            if (chunk.additional_kwargs?.reasoning_content) {
              controller.enqueue(encoder.encode(`event: thinking\ndata: ${JSON.stringify({ content: chunk.additional_kwargs.reasoning_content })}\n\n`));
              continue;
            }

            if (chunk.content) {
              buffer += chunk.content;
              
              if (!thinkTagMatched) {
                if (buffer.includes('<think>')) {
                  isThinking = true;
                  thinkTagMatched = true;
                  buffer = buffer.split('<think>')[1] || '';
                } else if ('<think>'.startsWith(buffer)) {
                  // Wait for more chunks to see if it's the start of a <think> tag
                  continue;
                } else {
                  thinkTagMatched = true;
                }
              }

              if (isThinking) {
                if (buffer.includes('</think>')) {
                  isThinking = false;
                  const parts = buffer.split('</think>');
                  if (parts[0]) {
                    controller.enqueue(encoder.encode(`event: thinking\ndata: ${JSON.stringify({ content: parts[0] })}\n\n`));
                  }
                  buffer = parts[1] || '';
                  if (buffer) {
                    controller.enqueue(encoder.encode(`event: message\ndata: ${JSON.stringify({ content: buffer })}\n\n`));
                    buffer = '';
                  }
                } else if (buffer.length > 10) {
                  // Emit all but last 10 chars to be safe from splitting '</think>'
                  const toEmit = buffer.slice(0, -10);
                  buffer = buffer.slice(-10);
                  controller.enqueue(encoder.encode(`event: thinking\ndata: ${JSON.stringify({ content: toEmit })}\n\n`));
                }
              } else {
                if (buffer) {
                  controller.enqueue(encoder.encode(`event: message\ndata: ${JSON.stringify({ content: buffer })}\n\n`));
                  buffer = '';
                }
              }
            }
          }

          if (buffer) {
            const event = isThinking ? 'thinking' : 'message';
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify({ content: buffer })}\n\n`));
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
