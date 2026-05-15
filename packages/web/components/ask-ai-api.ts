export type AskApiCitation = {
  citation_id: string;
  title: string;
  url: string | null;
  breadcrumb?: Array<{ title: string; type?: string }>;
};

export type AskApiResponse =
  | {
      type: 'answer';
      answer_md: string;
      citations?: AskApiCitation[];
    }
  | {
      type: 'clarify';
      message: string;
      options?: Array<{ label: string }>;
    }
  | {
      type: 'error';
      code?: string;
      message?: string;
    };

export function isEmptyAskStreamResponse(response: AskApiResponse): boolean {
  return response.type === 'error' && response.code === 'empty_stream';
}

export function shouldUseAskJsonFallback(_input: {
  streamStarted: boolean;
  response?: AskApiResponse;
  error?: unknown;
}): boolean {
  return false;
}

type AskResponseMeta = {
  contentType?: string | null;
  status?: number;
  statusText?: string;
};

type LocationLike = {
  protocol: string;
  hostname: string;
};

const ASK_PATH = '/v1/ask';
const ASK_STREAM_PATH = '/v1/ask/stream';
const DEFAULT_ASK_PROXY_PATH = '/ask-api';
const DEFAULT_MAX_CHUNKS = 5;

function getConfiguredAskBaseUrl() {
  if (typeof process === 'undefined') {
    return '';
  }
  return process.env.NEXT_PUBLIC_ANYDOCS_ASK_URL?.trim() ?? '';
}

function getBrowserLocation(): LocationLike | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.location;
}

export function resolveAskEndpoint(
  configuredBaseUrl = getConfiguredAskBaseUrl(),
  _locationLike: LocationLike | null = getBrowserLocation(),
) {
  const trimmed = configuredBaseUrl.trim();
  if (trimmed.length > 0) {
    const normalized = trimmed.replace(/\/+$/, '');
    return normalized.endsWith(ASK_PATH) ? normalized : `${normalized}${ASK_PATH}`;
  }

  return `${DEFAULT_ASK_PROXY_PATH}${ASK_PATH}`;
}

export function resolveAskStreamEndpoint(
  configuredBaseUrl = getConfiguredAskBaseUrl(),
  _locationLike: LocationLike | null = getBrowserLocation(),
) {
  const trimmed = configuredBaseUrl.trim();
  if (trimmed.length > 0) {
    const normalized = trimmed.replace(/\/+$/, '');
    if (normalized.endsWith(ASK_STREAM_PATH)) return normalized;
    if (normalized.endsWith(ASK_PATH)) {
      return `${normalized}/stream`;
    }
    return `${normalized}${ASK_STREAM_PATH}`;
  }

  return `${DEFAULT_ASK_PROXY_PATH}${ASK_STREAM_PATH}`;
}

export function buildAskRequestBody(
  question: string,
  currentPageId: string | null | undefined,
  maxChunks = DEFAULT_MAX_CHUNKS,
) {
  const body: {
    question: string;
    context?: { current_page_id: string };
    options: { max_chunks: number };
  } = {
    question: question.trim(),
    options: { max_chunks: maxChunks },
  };

  if (currentPageId) {
    body.context = { current_page_id: currentPageId };
  }

  return body;
}

export function parseAskResponseText(
  raw: string,
  meta: AskResponseMeta = {},
): AskApiResponse {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      type: 'error',
      code: meta.status ? 'http_error' : undefined,
      message: `${meta.status ?? ''} ${meta.statusText ?? ''}`.trim() || 'empty response',
    };
  }

  try {
    return JSON.parse(trimmed) as AskApiResponse;
  } catch {
    // Continue below: gateways such as Cloudflare return HTML error pages.
  }

  const contentType = meta.contentType?.toLowerCase() ?? '';
  const looksLikeHtml =
    contentType.includes('text/html') ||
    /^<!doctype html/i.test(trimmed) ||
    /^<html[\s>]/i.test(trimmed);

  if (looksLikeHtml) {
    return {
      type: 'error',
      code: meta.status === 504 ? 'gateway_timeout' : 'http_error',
      message: meta.statusText || (meta.status ? `HTTP ${meta.status}` : 'gateway error'),
    };
  }

  return { type: 'error', message: trimmed };
}

export type AskStreamHandlers = {
  onStatus?: (stage: string) => void;
  onDelta?: (text: string) => void;
  onResult?: (response: AskApiResponse) => void;
  onDone?: () => void;
};

type RawSseEvent = {
  event: string;
  data: string;
};

export async function readAskStreamResponse(
  response: Response,
  handlers: AskStreamHandlers = {},
): Promise<AskApiResponse> {
  const contentType = response.headers.get('content-type');
  if (!contentType?.toLowerCase().includes('text/event-stream') || !response.body) {
    const raw = await response.text();
    return parseAskResponseText(raw, {
      contentType,
      status: response.status,
      statusText: response.statusText,
    });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult: AskApiResponse | null = null;

  const consumeBlock = (block: string) => {
    const rawEvent = parseRawSseEvent(block);
    if (!rawEvent) return;
    const parsed = parseSseJson(rawEvent.data);
    if (parsed === null) return;

    if (rawEvent.event === 'status') {
      const stage = getStringProperty(parsed, 'stage');
      if (stage) handlers.onStatus?.(stage);
      return;
    }

    if (rawEvent.event === 'delta') {
      const text = getStringProperty(parsed, 'text');
      if (text) handlers.onDelta?.(text);
      return;
    }

    if (rawEvent.event === 'result') {
      finalResult = parsed as AskApiResponse;
      handlers.onResult?.(finalResult);
      return;
    }

    if (rawEvent.event === 'error') {
      finalResult = {
        type: 'error',
        message: typeof parsed === 'string' ? parsed : getStringProperty(parsed, 'message') ?? 'stream error',
      };
      handlers.onResult?.(finalResult);
      return;
    }

    if (rawEvent.event === 'done') {
      handlers.onDone?.();
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split(/\r?\n\r?\n/);
    buffer = parts.pop() ?? '';
    for (const part of parts) {
      consumeBlock(part);
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    consumeBlock(buffer);
  }

  return (
    finalResult ?? {
      type: 'error',
      code: response.ok ? 'empty_stream' : 'http_error',
      message: response.ok ? 'empty stream response' : `${response.status} ${response.statusText}`.trim(),
    }
  );
}

function parseRawSseEvent(block: string): RawSseEvent | null {
  let event = 'message';
  const dataLines: string[] = [];
  for (const rawLine of block.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (line.startsWith('event:')) {
      event = line.slice('event:'.length).trimStart();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trimStart());
    }
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join('\n') };
}

function parseSseJson(data: string): unknown | null {
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

function getStringProperty(value: unknown, key: string): string | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = (value as Record<string, unknown>)[key];
  return typeof raw === 'string' ? raw : null;
}

export function formatAskResponseMessage(response: AskApiResponse, lang: string) {
  if (response.type === 'answer') {
    const citations = response.citations ?? [];
    if (citations.length === 0) {
      return response.answer_md;
    }

    const heading = lang === 'zh' ? '参考来源' : 'Sources';
    const sourceLines = citations.map((citation, index) => {
      const marker = citation.citation_id || `cit_${index + 1}`;
      if (citation.url) {
        return `- [${marker}] [${citation.title}](${citation.url})`;
      }

      return `- [${marker}] ${citation.title}`;
    });

    return `${response.answer_md}\n\n---\n\n**${heading}:**\n${sourceLines.join('\n')}`;
  }

  if (response.type === 'clarify') {
    const options = response.options ?? [];
    if (options.length === 0) {
      return response.message;
    }

    return `${response.message}\n\n${options.map((option) => `- ${option.label}`).join('\n')}`;
  }

  if (response.code === 'gateway_timeout') {
    return lang === 'zh'
      ? '暂时无法回答：请求超时，请稍后重试。'
      : 'Unable to answer right now: the request timed out. Please try again.';
  }

  const fallback = lang === 'zh' ? '请求失败' : 'request failed';
  return lang === 'zh'
    ? `暂时无法回答：${response.message ?? fallback}`
    : `Unable to answer right now: ${response.message ?? fallback}`;
}
