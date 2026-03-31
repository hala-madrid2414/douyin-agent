import OpenAI from 'openai';

const SYSTEM_PROMPT = `你是一个专属旅行助手，专门为用户提供专业、贴心的旅行规划和建议。
你可以帮助用户制定行程、推荐景点、解答关于目的地的各种问题。
在回答时，请保持热情、专业，并尽可能提供具体、实用的信息。`;

export const post = async ({ data }: { data: { conversationId: string; content: string } }) => {
  const apiKey = process.env.DASHSCOPE_API_KEY || process.env.API_KEY || '';
  
  if (!apiKey) {
    return {
      code: 500,
      message: 'API key is missing. Please check your .env.local file.',
      data: null
    };
  }

  const openai = new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  });

  try {
    const completion = await openai.chat.completions.create({
      model: 'qwen3-max', // Or qwen3-max as requested
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: data.content },
      ],
    });

    return {
      code: 200,
      data: {
        id: completion.id,
        content: completion.choices[0].message.content,
        timestamp: Date.now(),
      }
    };
  } catch (error) {
    console.error('LLM API Error:', error);
    return {
      code: 500,
      message: 'Failed to generate response from LLM',
      data: null
    };
  }
};
