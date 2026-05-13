export type AskApiCitation = {
  citation_id: string;
  title: string;
  url: string | null;
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

type LocationLike = {
  protocol: string;
  hostname: string;
};

const ASK_PATH = '/v1/ask';
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

export function formatAskResponseMessage(response: AskApiResponse, lang: string) {
  if (response.type === 'answer') {
    const citations = response.citations ?? [];
    if (citations.length === 0) {
      return response.answer_md;
    }

    const heading = lang === 'zh' ? '参考来源' : 'Sources';
    const sourceLines = citations.map((citation, index) => {
      const marker = citation.citation_id || `cit_${index + 1}`;
      const href = citation.url ? ` - ${citation.url}` : '';
      return `[${marker}] ${citation.title}${href}`;
    });

    return `${response.answer_md}\n\n${heading}:\n${sourceLines.join('\n')}`;
  }

  if (response.type === 'clarify') {
    const options = response.options ?? [];
    if (options.length === 0) {
      return response.message;
    }

    return `${response.message}\n\n${options.map((option) => `- ${option.label}`).join('\n')}`;
  }

  const fallback = lang === 'zh' ? '请求失败' : 'request failed';
  return lang === 'zh'
    ? `暂时无法回答：${response.message ?? fallback}`
    : `Unable to answer right now: ${response.message ?? fallback}`;
}
