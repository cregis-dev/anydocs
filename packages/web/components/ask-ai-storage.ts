import type { AskApiCitation, AskFeedbackRating } from '@/components/ask-ai-api';

export const ASK_CONVERSATION_STORAGE_TTL_MS = 30 * 60 * 1000;
export const ASK_CONVERSATION_MAX_MESSAGES = 40;

const STORAGE_VERSION = 1;
const STORAGE_PREFIX = 'anydocs:ask-ai:conversation:v1';
const MAX_STORED_CONTENT_CHARS = 50_000;

export type PersistedAskMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  answerId?: string;
  sessionId?: string;
  citations?: AskApiCitation[];
  feedbackRating?: AskFeedbackRating;
  feedbackStatus?: 'sent' | 'error';
};

export type PersistedAskConversation = {
  version: 1;
  sessionId: string | null;
  updatedAt: number;
  messages: PersistedAskMessage[];
};

type AskConversationMessageInput = Omit<PersistedAskMessage, 'feedbackStatus'> & {
  feedbackStatus?: 'sending' | 'sent' | 'error';
};

const SENSITIVE_KEY = [
  'authorization',
  'api[_-]?key',
  'access[_-]?key',
  'access[_-]?signature',
  'secret',
  'client[_-]?secret',
  'private[_-]?key',
  'password',
  'passwd',
  'cookie',
  'session[_-]?id',
  'token',
  'auth[_-]?token',
  'sign',
  'signature',
].join('|');

const QUOTED_SECRET_RE = new RegExp(
  `(["']?(?:${SENSITIVE_KEY})["']?\\s*[:=]\\s*)(["'])([^"'\\r\\n]*)(\\2)`,
  'gi',
);
const BARE_SECRET_RE = new RegExp(
  `(^|[,{;\\s])((?:${SENSITIVE_KEY})\\s*[:=]\\s*)([^,;}\\s]+)`,
  'gim',
);
const HEADER_SECRET_RE = new RegExp(
  `(^|\\s)([ \\t]*(?:--header\\s+)?["']?(?:authorization|access[_-]?key|access[_-]?signature|x-api-key|cookie)\\s*:\\s*)[^\\r\\n"']+`,
  'gi',
);

export function askConversationStorageKey(lang: string, endpointBaseUrl?: string): string {
  const language = lang.trim().toLowerCase() || 'en';
  const endpoint = endpointBaseUrl?.trim().replace(/\/+$/, '') || 'same-origin';
  return `${STORAGE_PREFIX}:${encodeURIComponent(language)}:${encodeURIComponent(endpoint)}`;
}

export function redactAskStorageText(input: string): string {
  return input
    .replace(HEADER_SECRET_RE, (_match, prefix: string, key: string) => `${prefix}${key}[REDACTED]`)
    .replace(QUOTED_SECRET_RE, (_match, prefix: string, quote: string) => (
      `${prefix}${quote}[REDACTED]${quote}`
    ))
    .replace(BARE_SECRET_RE, (_match, boundary: string, prefix: string) => (
      `${boundary}${prefix}[REDACTED]`
    ));
}

export function createPersistedAskConversation(
  messages: AskConversationMessageInput[],
  sessionId: string | null,
  now = Date.now(),
): PersistedAskConversation {
  return {
    version: STORAGE_VERSION,
    sessionId: cleanOptionalString(sessionId, 256) ?? null,
    updatedAt: now,
    messages: messages
      .slice(-ASK_CONVERSATION_MAX_MESSAGES)
      .map(sanitizeMessage),
  };
}

export function parsePersistedAskConversation(
  raw: string,
  now = Date.now(),
): PersistedAskConversation | null {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (!value || typeof value !== 'object' || value.version !== STORAGE_VERSION) return null;
    if (typeof value.updatedAt !== 'number' || !Number.isFinite(value.updatedAt)) return null;
    if (value.updatedAt > now + 60_000 || now - value.updatedAt > ASK_CONVERSATION_STORAGE_TTL_MS) {
      return null;
    }
    if (!Array.isArray(value.messages)) return null;

    const messages = value.messages
      .map(parseMessage)
      .filter((message): message is PersistedAskMessage => message !== null)
      .slice(-ASK_CONVERSATION_MAX_MESSAGES);
    if (messages.length === 0) return null;

    return {
      version: STORAGE_VERSION,
      sessionId: cleanOptionalString(value.sessionId, 256) ?? null,
      updatedAt: value.updatedAt,
      messages,
    };
  } catch {
    return null;
  }
}

function sanitizeMessage(message: AskConversationMessageInput): PersistedAskMessage {
  const answerId = cleanOptionalString(message.answerId, 256);
  const messageSessionId = cleanOptionalString(message.sessionId, 256);

  return {
    id: message.id.slice(0, 256),
    role: message.role,
    content: redactAskStorageText(message.content).slice(0, MAX_STORED_CONTENT_CHARS),
    ...(answerId ? { answerId } : {}),
    ...(messageSessionId ? { sessionId: messageSessionId } : {}),
    ...(message.citations ? { citations: sanitizeCitations(message.citations) } : {}),
    ...(message.feedbackRating === 1 || message.feedbackRating === -1
      ? { feedbackRating: message.feedbackRating }
      : {}),
    ...(message.feedbackStatus === 'sent' || message.feedbackStatus === 'error'
      ? { feedbackStatus: message.feedbackStatus }
      : {}),
  };
}

function parseMessage(value: unknown): PersistedAskMessage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.role !== 'user' && record.role !== 'assistant') return null;
  if (typeof record.id !== 'string' || typeof record.content !== 'string') return null;

  return sanitizeMessage({
    id: record.id,
    role: record.role,
    content: record.content,
    ...(typeof record.answerId === 'string' ? { answerId: record.answerId } : {}),
    ...(typeof record.sessionId === 'string' ? { sessionId: record.sessionId } : {}),
    ...(Array.isArray(record.citations) ? { citations: parseCitations(record.citations) } : {}),
    ...(record.feedbackRating === 1 || record.feedbackRating === -1
      ? { feedbackRating: record.feedbackRating }
      : {}),
    ...(record.feedbackStatus === 'sent' || record.feedbackStatus === 'error'
      ? { feedbackStatus: record.feedbackStatus }
      : {}),
  });
}

function sanitizeCitations(citations: AskApiCitation[]): AskApiCitation[] {
  return citations.slice(0, 20).map((citation) => ({
    citation_id: citation.citation_id.slice(0, 80),
    title: citation.title.slice(0, 500),
    url: citation.url?.slice(0, 2_000) ?? null,
    ...(citation.page_id ? { page_id: citation.page_id.slice(0, 256) } : {}),
    ...(citation.lang ? { lang: citation.lang.slice(0, 20) } : {}),
    ...(citation.breadcrumb
      ? {
          breadcrumb: citation.breadcrumb.slice(0, 20).map((item) => ({
            title: item.title.slice(0, 500),
            ...(item.type ? { type: item.type.slice(0, 80) } : {}),
          })),
        }
      : {}),
  }));
}

function parseCitations(values: unknown[]): AskApiCitation[] {
  const citations: AskApiCitation[] = [];
  for (const value of values) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const record = value as Record<string, unknown>;
    if (typeof record.citation_id !== 'string' || typeof record.title !== 'string') continue;
    citations.push({
      citation_id: record.citation_id,
      title: record.title,
      url: typeof record.url === 'string' ? record.url : null,
      ...(typeof record.page_id === 'string' ? { page_id: record.page_id } : {}),
      ...(typeof record.lang === 'string' ? { lang: record.lang } : {}),
      ...(Array.isArray(record.breadcrumb)
        ? {
            breadcrumb: record.breadcrumb.flatMap((item) => {
              if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
              const breadcrumb = item as Record<string, unknown>;
              if (typeof breadcrumb.title !== 'string') return [];
              return [{
                title: breadcrumb.title,
                ...(typeof breadcrumb.type === 'string' ? { type: breadcrumb.type } : {}),
              }];
            }),
          }
        : {}),
    });
    if (citations.length >= 20) break;
  }
  return citations;
}

function cleanOptionalString(value: unknown, maxChars: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.trim().slice(0, maxChars);
  return cleaned || undefined;
}
