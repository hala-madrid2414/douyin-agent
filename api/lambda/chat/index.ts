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
type WeatherType = 'now' | '3d' | '7d' | '24h';

interface ChatRequestData {
  content?: string;
  enableThinking?: boolean;
  forceToolCall?: boolean;
}

const REALTIME_HINT_PATTERNS = [
  /今天|明天|后天|这周|本周|当前|现在|最近|实时|最新/,
  /开放|营业|闭园|关门|排队|人流|拥挤|预约|门票/,
];
const NON_WEATHER_REALTIME_HINT_PATTERNS = [
  /开放|营业|闭园|关门|排队|人流|拥挤|预约|门票/,
  /活动|演出|展览|交通|路况|限流|预约/,
];
const WEATHER_HINT_PATTERNS = [
  /天气|气温|温度|降雨|下雨|晴天|阴天|台风|空气质量|风力|湿度|预报/,
  /穿什么|带伞|会不会下雨|冷不冷|热不热/,
];

const DEFAULT_TAVILY_URL = 'https://api.tavily.com/search';
const WEATHER_ENDPOINTS: Record<WeatherType, string> = {
  now: '/weather/now',
  '3d': '/weather/3d',
  '7d': '/weather/7d',
  '24h': '/weather/24h',
};

interface QWeatherConfig {
  credentialId: string;
  apiKey: string;
  weatherBaseUrl: string;
  geoBaseUrl: string;
  timeoutMs: number;
  maxRetry: number;
}

interface QWeatherLocation {
  id: string;
  name: string;
  adm1?: string;
  adm2?: string;
  country?: string;
  lat?: string;
  lon?: string;
}

type QWeatherNow = {
  obsTime?: string;
  temp?: string;
  feelsLike?: string;
  text?: string;
  windDir?: string;
  windScale?: string;
  humidity?: string;
  precip?: string;
};

type QWeatherDaily = {
  fxDate?: string;
  tempMax?: string;
  tempMin?: string;
  textDay?: string;
  textNight?: string;
  humidity?: string;
  precip?: string;
};

type QWeatherHourly = {
  fxTime?: string;
  temp?: string;
  text?: string;
  pop?: string;
  windDir?: string;
  windScale?: string;
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const toMaskedFingerprint = (value: string | undefined): string => {
  if (!value) {
    return 'empty';
  }
  if (value.length <= 8) {
    return `len_${value.length}`;
  }
  return `${value.slice(0, 3)}***${value.slice(-3)}(len_${value.length})`;
};

const sanitizeUrlForLog = (rawUrl: string): string => {
  try {
    const parsed = new URL(rawUrl);
    const sensitiveParams = ['key', 'api_key', 'apikey', 'token'];
    for (const name of sensitiveParams) {
      if (parsed.searchParams.has(name)) {
        parsed.searchParams.set(name, '***');
      }
    }
    return parsed.toString();
  } catch {
    return rawUrl.replace(
      /([?&](?:key|api_key|apikey|token)=)[^&]*/gi,
      '$1***',
    );
  }
};

const sanitizeTextForLog = (text: string, maxLen = 280): string => {
  if (!text) {
    return '';
  }
  return text
    .replace(/[A-Za-z0-9_-]{20,}/g, '***')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
};

const parseJsonWithDiagnostic = <T>(
  rawText: string,
  context: Record<string, unknown>,
): T => {
  try {
    return JSON.parse(rawText) as T;
  } catch {
    console.error('Tool response parse failed:', {
      ...context,
      bodyPreview: sanitizeTextForLog(rawText),
    });
    throw new Error('tool_response_parse_failed');
  }
};

const toPositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
};

const shouldUseWeatherTool = (query: string): boolean => {
  const normalized = query.trim();
  if (!normalized) {
    return false;
  }
  return WEATHER_HINT_PATTERNS.some(pattern => pattern.test(normalized));
};

const inferWeatherTypeFromQuery = (query: string): WeatherType => {
  if (/24\s*小时|逐小时|小时级/.test(query)) {
    return '24h';
  }
  if (/7\s*天|一周|未来一周|本周|下周/.test(query)) {
    return '7d';
  }
  if (/3\s*天|三天|未来三天/.test(query)) {
    return '3d';
  }
  return 'now';
};

const parseCityNameFromQuery = (query: string): string | null => {
  const normalized = query.replace(/\s+/g, '');
  const cityPatterns = [
    /([一-龥]{2,12})(?:市|区|县|州|盟)?(?:今天|明天|后天|未来|近期|现在)?(?:天气|气温|温度|降雨|预报)/,
    /(?:在|去|到|想去|准备去)([一-龥]{2,12})(?:旅游|旅行|玩|出差)?/,
    /([一-龥]{2,12})(?:未来|近|这|本)?(?:3天|三天|7天|一周|24小时)(?:天气|预报)?/,
  ];
  const stopWords = [
    '今天',
    '明天',
    '后天',
    '未来',
    '近期',
    '现在',
    '这周',
    '本周',
    '天气',
    '气温',
    '温度',
    '降雨',
    '预报',
    '旅游',
    '旅行',
    '怎么样',
    '如何',
  ];

  for (const pattern of cityPatterns) {
    const matched = normalized.match(pattern);
    const candidate = matched?.[1];
    if (!candidate) {
      continue;
    }
    let city = candidate;
    for (const token of stopWords) {
      city = city.replaceAll(token, '');
    }
    city = city.replace(/(省|市|区|县|州|盟)$/g, '').trim();
    if (city.length >= 2) {
      return city;
    }
  }
  return null;
};

const normalizeBaseUrl = (raw: string, envName: string): string => {
  const trimmed = raw.trim().replace(/^['"`]+|['"`]+$/g, '');
  if (!trimmed) {
    throw new Error(`${envName} is missing`);
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    throw new Error(`${envName} is invalid URL`);
  }
};

const getQWeatherConfig = (): QWeatherConfig => {
  const apiKey = process.env.QWEATHER_API_KEY || '';
  const credentialId = process.env.QWEATHER_CREDENTIAL_ID || '';
  const weatherBaseUrl = normalizeBaseUrl(
    process.env.QWEATHER_WEATHER_BASE_URL || '',
    'QWEATHER_WEATHER_BASE_URL',
  );
  const geoBaseUrl = normalizeBaseUrl(
    process.env.QWEATHER_GEO_BASE_URL || '',
    'QWEATHER_GEO_BASE_URL',
  );
  if (!apiKey) {
    throw new Error('QWEATHER_API_KEY is missing');
  }

  return {
    apiKey,
    credentialId,
    weatherBaseUrl,
    geoBaseUrl,
    timeoutMs: toPositiveInt(
      process.env.QWEATHER_TIMEOUT_MS || process.env.TOOL_CALL_TIMEOUT,
      10000,
    ),
    maxRetry: toPositiveInt(
      process.env.QWEATHER_RETRY_TIMES || process.env.TOOL_CALL_RETRY_TIMES,
      1,
    ),
  };
};

const fetchJsonWithTimeoutRetry = async <T>(
  url: string,
  timeoutMs: number,
  maxRetry: number,
): Promise<T> => {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetry; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      const rawText = await response.text();
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok) {
        console.error('QWeather HTTP failure:', {
          status: response.status,
          contentType,
          url: sanitizeUrlForLog(url),
          attempt,
          maxRetry,
          bodyPreview: sanitizeTextForLog(rawText),
        });
        throw new Error(`http_${response.status}`);
      }
      const bodyText = rawText.trim();
      if (!bodyText) {
        console.error('QWeather empty response body:', {
          status: response.status,
          contentType,
          url: sanitizeUrlForLog(url),
          attempt,
          maxRetry,
        });
        throw new Error('qweather_empty_body');
      }
      const maybeJson = /^[\[{]/.test(bodyText);
      if (!maybeJson) {
        console.error('QWeather non-JSON response body:', {
          status: response.status,
          contentType,
          url: sanitizeUrlForLog(url),
          attempt,
          maxRetry,
          bodyPreview: sanitizeTextForLog(bodyText),
        });
        throw new Error('qweather_non_json_body');
      }
      let json: T & { code?: string };
      try {
        json = JSON.parse(bodyText) as T & { code?: string };
      } catch {
        console.error('QWeather JSON parse failed:', {
          status: response.status,
          contentType,
          url: sanitizeUrlForLog(url),
          attempt,
          maxRetry,
          bodyPreview: sanitizeTextForLog(bodyText),
        });
        throw new Error('qweather_invalid_json');
      }
      if (json?.code && json.code !== '200') {
        console.error('QWeather business code failure:', {
          code: json.code,
          url: sanitizeUrlForLog(url),
          attempt,
          maxRetry,
        });
        throw new Error(`qweather_code_${json.code}`);
      }
      return json;
    } catch (error) {
      lastError = error;
      if (attempt < maxRetry) {
        await wait(Math.min(300 * (attempt + 1), 800));
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('qweather_failed');
};

const buildQWeatherUrl = (
  baseUrl: string,
  pathname: string,
  query: Record<string, string>,
): string => {
  const url = new URL(`${baseUrl.replace(/\/+$/, '')}${pathname}`);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
};

const resolveQWeatherCity = async (
  cityName: string,
  config: QWeatherConfig,
): Promise<QWeatherLocation> => {
  const url = buildQWeatherUrl(config.geoBaseUrl, '/city/lookup', {
    location: cityName,
    number: '1',
    lang: 'zh',
    key: config.apiKey,
  });
  const response = await fetchJsonWithTimeoutRetry<{
    location?: QWeatherLocation[];
  }>(url, config.timeoutMs, config.maxRetry);

  const city = Array.isArray(response.location) ? response.location[0] : null;
  if (!city?.id) {
    throw new Error('qweather_city_not_found');
  }
  return city;
};

const fetchQWeatherByType = async (
  cityId: string,
  type: WeatherType,
  config: QWeatherConfig,
): Promise<QWeatherNow | QWeatherDaily[] | QWeatherHourly[]> => {
  const url = buildQWeatherUrl(config.weatherBaseUrl, WEATHER_ENDPOINTS[type], {
    location: cityId,
    lang: 'zh',
    key: config.apiKey,
  });
  const response = await fetchJsonWithTimeoutRetry<{
    now?: QWeatherNow;
    daily?: QWeatherDaily[];
    hourly?: QWeatherHourly[];
  }>(url, config.timeoutMs, config.maxRetry);

  if (type === 'now') {
    return response.now || {};
  }
  if (type === '24h') {
    return Array.isArray(response.hourly) ? response.hourly : [];
  }
  return Array.isArray(response.daily) ? response.daily : [];
};

const formatQWeatherContext = ({
  location,
  preferredType,
  datasets,
}: {
  location: QWeatherLocation;
  preferredType: WeatherType;
  datasets: Partial<
    Record<WeatherType, QWeatherNow | QWeatherDaily[] | QWeatherHourly[]>
  >;
}): string => {
  const lines: string[] = [
    '【天气标准化上下文】',
    `city_name=${sanitizeForPrompt(location.name || '', 32)}`,
    `city_id=${sanitizeForPrompt(location.id || '', 32)}`,
    `city_admin=${sanitizeForPrompt(
      [location.adm2, location.adm1, location.country]
        .filter(Boolean)
        .join('/'),
      80,
    )}`,
    `preferred_type=${preferredType}`,
  ];

  const now = (datasets.now || {}) as QWeatherNow;
  lines.push(
    `now=${sanitizeForPrompt(
      [
        now.text ? `天气${now.text}` : '',
        now.temp ? `${now.temp}°C` : '',
        now.feelsLike ? `体感${now.feelsLike}°C` : '',
        now.windDir || now.windScale
          ? `风${[now.windDir, now.windScale].filter(Boolean).join(' ')}级`
          : '',
        now.humidity ? `湿度${now.humidity}%` : '',
        now.precip ? `降水${now.precip}mm` : '',
        now.obsTime ? `观测${now.obsTime}` : '',
      ]
        .filter(Boolean)
        .join('，') || '暂无',
      300,
    )}`,
  );

  const hourly = (datasets['24h'] || []) as QWeatherHourly[];
  lines.push(
    `hourly_24h=${sanitizeForPrompt(
      hourly
        .slice(0, 6)
        .map(item =>
          [
            item.fxTime || '',
            item.text || '',
            item.temp ? `${item.temp}°C` : '',
            item.pop ? `降水概率${item.pop}%` : '',
          ]
            .filter(Boolean)
            .join(' '),
        )
        .join(' | ') || '暂无',
      480,
    )}`,
  );

  const threeDays = (datasets['3d'] || []) as QWeatherDaily[];
  lines.push(
    `daily_3d=${sanitizeForPrompt(
      threeDays
        .slice(0, 3)
        .map(item =>
          [
            item.fxDate || '',
            item.textDay || item.textNight || '',
            item.tempMin || item.tempMax
              ? `${item.tempMin || '-'}~${item.tempMax || '-'}°C`
              : '',
          ]
            .filter(Boolean)
            .join(' '),
        )
        .join(' | ') || '暂无',
      360,
    )}`,
  );

  const sevenDays = (datasets['7d'] || []) as QWeatherDaily[];
  lines.push(
    `daily_7d=${sanitizeForPrompt(
      sevenDays
        .slice(0, 7)
        .map(item =>
          [
            item.fxDate || '',
            item.textDay || item.textNight || '',
            item.tempMin || item.tempMax
              ? `${item.tempMin || '-'}~${item.tempMax || '-'}°C`
              : '',
          ]
            .filter(Boolean)
            .join(' '),
        )
        .join(' | ') || '暂无',
      700,
    )}`,
  );

  return lines.join('\n');
};

const fetchQWeatherContext = async (query: string): Promise<string> => {
  const config = getQWeatherConfig();
  const cityName = parseCityNameFromQuery(query);
  if (!cityName) {
    throw new Error('qweather_city_parse_failed');
  }

  const location = await resolveQWeatherCity(cityName, config);
  const preferredType = inferWeatherTypeFromQuery(query);
  const weatherTypes: WeatherType[] = ['now', '24h', '3d', '7d'];

  const settled = await Promise.allSettled(
    weatherTypes.map(type => fetchQWeatherByType(location.id, type, config)),
  );

  const datasets: Partial<
    Record<WeatherType, QWeatherNow | QWeatherDaily[] | QWeatherHourly[]>
  > = {};
  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      datasets[weatherTypes[index]] = result.value;
    }
  });

  const hasAnyDataset = weatherTypes.some(type => Boolean(datasets[type]));
  if (!hasAnyDataset) {
    throw new Error('qweather_no_dataset');
  }

  return formatQWeatherContext({ location, preferredType, datasets });
};

const shouldUseRealtimeTool = (query: string): boolean => {
  const normalized = query.trim();
  if (!normalized) {
    return false;
  }
  return REALTIME_HINT_PATTERNS.some(pattern => pattern.test(normalized));
};

const shouldUseNonWeatherRealtimeTool = (query: string): boolean => {
  const normalized = query.trim();
  if (!normalized) {
    return false;
  }
  return NON_WEATHER_REALTIME_HINT_PATTERNS.some(pattern =>
    pattern.test(normalized),
  );
};

const sanitizeForPrompt = (text: string, max = 700): string => {
  return text.replace(/\s+/g, ' ').trim().slice(0, max);
};

const maskSensitiveError = (error: unknown): string => {
  if (error instanceof Error) {
    const message = error.message || 'unknown_error';
    if (/^[A-Za-z0-9_]+$/.test(message)) {
      return message;
    }
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
  const endpointLog = sanitizeUrlForLog(endpoint);

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= maxRetry; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          query,
          include_answer: false,
          search_depth: 'basic',
          max_results: maxResults,
          topic: 'general',
        }),
        signal: controller.signal,
      });

      const rawText = await response.text();
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok) {
        console.error('Tavily HTTP failure:', {
          status: response.status,
          contentType,
          endpoint: endpointLog,
          attempt,
          maxRetry,
          apiKeyFingerprint: toMaskedFingerprint(apiKey),
          queryLength: query.length,
          bodyPreview: sanitizeTextForLog(rawText),
        });
        throw new Error(`tavily_http_${response.status}`);
      }

      const json = parseJsonWithDiagnostic<{ results?: TavilySearchResult[] }>(
        rawText,
        {
          tool: 'tavily',
          reason: 'invalid_json',
          status: response.status,
          contentType,
          endpoint: endpointLog,
          attempt,
        },
      );
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
    ...(data?.enableThinking
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

        const emitToolStatus = (
          tool: 'tavily' | 'qweather',
          status: ToolStatus,
          detail?: string,
        ) => {
          safeEmitSse('tool_status', {
            tool,
            status,
            title: tool === 'qweather' ? '和风天气查询' : '联网旅行信息查询',
            detail: detail || '',
          });
        };

        try {
          const query = String(data?.content || '');
          const forceToolCall = Boolean(data?.forceToolCall);
          const hasWeatherIntent = shouldUseWeatherTool(query);
          const hasRealtimeIntent = shouldUseRealtimeTool(query);
          const hasNonWeatherRealtimeIntent =
            shouldUseNonWeatherRealtimeTool(query);
          let toolContext = '';
          let weatherContext = '';
          let toolFailed = false;
          let weatherFailed = false;

          if (hasWeatherIntent) {
            emitToolStatus('qweather', 'start', '正在查询目的地天气信息');
            try {
              weatherContext = await fetchQWeatherContext(query);
              emitToolStatus(
                'qweather',
                'success',
                '已完成 now/24h/3d/7d 天气整合',
              );
            } catch (error) {
              weatherFailed = true;
              console.error('QWeather tool failed:', maskSensitiveError(error));
              emitToolStatus(
                'qweather',
                'error',
                '天气工具调用失败，已切换为基础建议模式',
              );
            }
          }

          const shouldCallRealtimeTool =
            forceToolCall ||
            hasNonWeatherRealtimeIntent ||
            (!hasWeatherIntent && hasRealtimeIntent) ||
            (hasWeatherIntent && weatherFailed);

          if (shouldCallRealtimeTool) {
            const tavilyReason = hasWeatherIntent
              ? weatherFailed
                ? '天气查询失败，正在联网补充天气信息'
                : '正在联网检索景点开放等实时信息'
              : '正在联网检索实时旅行信息';
            emitToolStatus('tavily', 'start', tavilyReason);
            try {
              const results = await fetchTavilyWithRetry(query);
              toolContext = formatToolContext(results);
              emitToolStatus(
                'tavily',
                'success',
                results.length > 0
                  ? `已检索到 ${results.length} 条候选信息`
                  : '未检索到高置信结果',
              );
            } catch (error) {
              toolFailed = true;
              console.error('Tavily tool failed:', maskSensitiveError(error));
              emitToolStatus(
                'tavily',
                'error',
                hasWeatherIntent
                  ? '联网补充失败，已切换为基础建议模式'
                  : '工具调用失败，已切换为基础建议模式',
              );
            }
          }

          let finalSystemPrompt = SYSTEM_PROMPT;
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

          const messages = [
            new SystemMessage(finalSystemPrompt),
            new HumanMessage(query),
          ];

          const stream = await chat.stream(messages);

          for await (const chunk of stream) {
            if (request?.signal?.aborted) {
              isAborted = true;
              emitToolStatus('tavily', 'abort', '请求已中止');
              emitToolStatus('qweather', 'abort', '请求已中止');
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
