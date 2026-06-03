'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { ArrowUp, BookOpen, Sparkles, ThumbsDown, ThumbsUp, User, X } from 'lucide-react';

import {
  buildAskFeedbackRequestBody,
  buildAskRequestBody,
  formatAskResponseMessage,
  groupAskCitationsBySource,
  isEmptyAskStreamResponse,
  readAskStreamResponse,
  resolveAskFeedbackEndpoint,
  resolveAskStreamEndpoint,
  type AskFeedbackRating,
  type AskCitationSourceGroup,
  type AskApiCitation,
  type AskApiResponse,
} from '@/components/ask-ai-api';

const AskAIMarkdown = dynamic(() =>
  import('@/components/ask-ai-markdown').then((module) => module.AskAIMarkdown),
);

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  answerId?: string;
  sessionId?: string;
  citations?: AskApiCitation[];
  feedbackRating?: AskFeedbackRating;
  feedbackStatus?: 'sending' | 'sent' | 'error';
};

type AskAIProps = {
  className?: string;
  currentPageId?: string | null;
  endpointBaseUrl?: string;
  lang?: string;
};

function createMessage(
  role: Message['role'],
  content: string,
  citations: AskApiCitation[] = [],
): Message {
  return {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
    role,
    content,
    citations,
  };
}

function createIntroMessage(isZh: boolean): Message {
  return createMessage(
    'assistant',
    isZh
      ? '我是根据 Cregis 文档训练的 AI 助手，可以回答支付引擎、WaaS 钱包和 API 接入问题。'
      : 'I am an AI assistant trained on Cregis documentation. Ask me about payments, WaaS wallets, and API integration.',
  );
}

function assistantPayloadFromResponse(
  response: AskApiResponse,
  lang: string,
): Pick<Message, 'answerId' | 'content' | 'citations' | 'sessionId'> {
  if (response.type === 'answer') {
    return {
      answerId: response.answer_id,
      content: response.answer_md,
      citations: response.citations ?? [],
      sessionId: response.session_id,
    };
  }

  return {
    content: formatAskResponseMessage(response, lang),
    citations: [],
    sessionId: response.session_id,
  };
}

function citationIdNumber(citationId: string): string {
  return citationId.replace(/^cit_/, '');
}

function citationPath(citation: AskApiCitation): string {
  const parts =
    citation.breadcrumb
      ?.map((item) => item.title)
      .filter((title) => title && title !== citation.title) ?? [];
  return ['Docs', ...parts].join(' › ');
}

function SourceCard({
  group,
}: {
  group: AskCitationSourceGroup;
}) {
  const citation = group.citations[0];
  if (!citation) return null;

  const body = (
    <>
      <div className="mb-2 flex items-center gap-2 text-xs text-fd-muted-foreground">
        <span className="flex shrink-0 items-center gap-1">
          {group.citationIds.map((citationId) => (
            <span
              key={citationId}
              className="inline-flex size-5 items-center justify-center rounded-md bg-[color:var(--atlas-primary,var(--fd-primary))]/10 text-[11px] font-semibold text-[color:var(--atlas-primary,var(--fd-primary))]"
            >
              {citationIdNumber(citationId)}
            </span>
          ))}
        </span>
        <span className="truncate">{citationPath(citation)}</span>
      </div>
      <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-fd-foreground">
        <BookOpen className="size-4 shrink-0 text-[color:var(--atlas-primary,var(--fd-primary))]" />
        <span className="truncate">{group.title}</span>
      </div>
    </>
  );

  const className =
    'block rounded-lg border border-[color:var(--docs-divider,var(--fd-border))] bg-[color:color-mix(in_srgb,var(--atlas-panel-subtle,var(--fd-muted))_72%,white)] p-4 transition hover:border-[color:var(--atlas-primary,var(--fd-primary))]/35 hover:bg-[color:var(--docs-sidebar-hover,var(--fd-muted))]';

  const href = group.citations.length === 1 ? citation.url : group.url;

  if (href) {
    return (
      <a href={href} className={className}>
        {body}
      </a>
    );
  }

  return <div className={className}>{body}</div>;
}

function SourceList({
  citations,
  isZh,
}: {
  citations: AskApiCitation[];
  isZh: boolean;
}) {
  if (citations.length === 0) return null;
  const sourceGroups = groupAskCitationsBySource(citations);

  return (
    <div className="mt-6">
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-fd-muted-foreground">
        {isZh ? '参考来源' : 'Sources'}
      </div>
      <div className="space-y-2">
        {sourceGroups.map((group) => (
          <SourceCard
            key={group.key}
            group={group}
          />
        ))}
      </div>
    </div>
  );
}

function IntroCopy({ isZh }: { isZh: boolean }) {
  return (
    <p className="text-base leading-7 text-fd-foreground">
      {isZh ? '我是根据 ' : 'I am trained on '}
      <span className="inline-flex rounded-md bg-[color:var(--atlas-primary,var(--fd-primary))] px-2 py-0.5 font-semibold text-white">
        Cregis
      </span>
      {isZh
        ? ' 文档训练的 AI 助手，可以回答支付引擎、WaaS 钱包和 API 接入问题。'
        : ' documentation and can answer questions about payments, WaaS wallets, and API integration.'}
    </p>
  );
}

function LoadingCopy({ isZh }: { isZh: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm text-fd-muted-foreground">
      <span>{isZh ? '正在查询 Cregis 文档' : 'Searching Cregis docs'}</span>
      <span className="flex items-center gap-1">
        <span className="size-1.5 animate-bounce rounded-full bg-[color:var(--atlas-primary,var(--fd-primary))] [animation-delay:-0.3s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-[color:var(--atlas-primary,var(--fd-primary))] [animation-delay:-0.15s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-[color:var(--atlas-primary,var(--fd-primary))]" />
      </span>
    </div>
  );
}

function FeedbackControls({
  isZh,
  message,
  onFeedback,
}: {
  isZh: boolean;
  message: Message;
  onFeedback: (messageId: string, rating: AskFeedbackRating) => void;
}) {
  if (!message.answerId) return null;

  const isSending = message.feedbackStatus === 'sending';
  const isSent = message.feedbackStatus === 'sent';
  const label = isSent
    ? isZh
      ? '感谢反馈'
      : 'Thanks for the feedback'
    : isZh
      ? '这个回答有帮助吗？'
      : 'Was this answer helpful?';

  const buttonClass = (rating: AskFeedbackRating) => {
    const active = message.feedbackRating === rating && isSent;
    return [
      'inline-flex size-8 items-center justify-center rounded-full border transition',
      active
        ? 'border-[color:var(--atlas-primary,var(--fd-primary))] bg-[color:var(--atlas-primary,var(--fd-primary))]/10 text-[color:var(--atlas-primary,var(--fd-primary))]'
        : 'border-[color:var(--docs-divider,var(--fd-border))] text-fd-muted-foreground hover:border-[color:var(--atlas-primary,var(--fd-primary))]/40 hover:text-fd-foreground',
      isSending ? 'cursor-wait opacity-60' : '',
    ].join(' ');
  };

  return (
    <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-fd-muted-foreground">
      <span>{label}</span>
      <button
        type="button"
        onClick={() => onFeedback(message.id, 1)}
        disabled={isSending || isSent}
        aria-label={isZh ? '这个回答有帮助' : 'This answer was helpful'}
        title={isZh ? '有帮助' : 'Helpful'}
        className={buttonClass(1)}
      >
        <ThumbsUp className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => onFeedback(message.id, -1)}
        disabled={isSending || isSent}
        aria-label={isZh ? '这个回答没有帮助' : 'This answer was not helpful'}
        title={isZh ? '没有帮助' : 'Not helpful'}
        className={buttonClass(-1)}
      >
        <ThumbsDown className="size-4" />
      </button>
      {message.feedbackStatus === 'error' ? (
        <span className="text-red-600">
          {isZh ? '提交失败，请稍后再试' : 'Could not send feedback. Please try again.'}
        </span>
      ) : null}
    </div>
  );
}

function MessageRow({
  message,
  isIntro,
  isLoadingPlaceholder,
  isZh,
  onFeedback,
}: {
  message: Message;
  isIntro: boolean;
  isLoadingPlaceholder: boolean;
  isZh: boolean;
  onFeedback: (messageId: string, rating: AskFeedbackRating) => void;
}) {
  if (message.role === 'assistant' && message.content.length === 0 && !isLoadingPlaceholder) {
    return null;
  }

  const isUser = message.role === 'user';

  return (
    <div className="grid grid-cols-[2.75rem_1fr] gap-4 border-b border-[color:var(--docs-divider,var(--fd-border))] py-6 last:border-b-0">
      <div
        className={`flex size-10 items-center justify-center rounded-full ${
          isUser
            ? 'bg-[color:var(--atlas-primary,var(--fd-primary))] text-white shadow-[0_10px_28px_rgba(34,197,94,0.24)]'
            : 'border border-[color:var(--docs-divider,var(--fd-border))] bg-[color:color-mix(in_srgb,var(--atlas-panel-subtle,var(--fd-muted))_76%,white)] text-[color:var(--atlas-primary,var(--fd-primary))]'
        }`}
      >
        {isUser ? <User className="size-5" /> : <Sparkles className="size-5" />}
      </div>

      <div className="min-w-0 pt-1">
        {isIntro ? (
          <IntroCopy isZh={isZh} />
        ) : isUser ? (
          <p className="text-base font-medium leading-7 text-fd-foreground">{message.content}</p>
        ) : message.content.length > 0 ? (
          <>
            <AskAIMarkdown content={message.content} />
            <SourceList citations={message.citations ?? []} isZh={isZh} />
            <FeedbackControls isZh={isZh} message={message} onFeedback={onFeedback} />
          </>
        ) : (
          <LoadingCopy isZh={isZh} />
        )}
      </div>
    </div>
  );
}

export function AskAI({
  className,
  currentPageId,
  endpointBaseUrl,
  lang = 'en',
}: AskAIProps) {
  const isZh = lang === 'zh';
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>(() => [createIntroMessage(isZh)]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const closeDialog = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
    setOpen(false);
  }, []);

  const clearConversation = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
    setInput('');
    setMessages([createIntroMessage(isZh)]);
    sessionIdRef.current = null;
  }, [isZh]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDialog();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeDialog]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const appendToMessage = (id: string, text: string) => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === id ? { ...message, content: `${message.content}${text}` } : message,
      ),
    );
  };

  const replaceMessage = (
    id: string,
    content: string,
    citations: AskApiCitation[] = [],
    answerId?: string,
    sessionId?: string,
  ) => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === id
          ? {
              ...message,
              answerId,
              citations,
              content,
              sessionId,
              feedbackRating: undefined,
              feedbackStatus: undefined,
            }
          : message,
      ),
    );
  };

  const handleFeedback = useCallback(
    async (messageId: string, rating: AskFeedbackRating) => {
      const target = messages.find((message) => message.id === messageId);
      if (
        !target?.answerId ||
        target.feedbackStatus === 'sending' ||
        target.feedbackStatus === 'sent'
      ) {
        return;
      }

      setMessages((prev) =>
        prev.map((message) =>
          message.id === messageId
            ? { ...message, feedbackRating: rating, feedbackStatus: 'sending' }
            : message,
        ),
      );

      try {
        const response = await fetch(resolveAskFeedbackEndpoint(endpointBaseUrl), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(
            buildAskFeedbackRequestBody({
              answerId: target.answerId,
              currentPageId,
              generated: target.content,
              rating,
              sessionId: target.sessionId ?? sessionIdRef.current,
            }),
          ),
        });

        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`.trim());
        }

        setMessages((prev) =>
          prev.map((message) =>
            message.id === messageId
              ? { ...message, feedbackRating: rating, feedbackStatus: 'sent' }
              : message,
          ),
        );
      } catch {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === messageId
              ? { ...message, feedbackRating: rating, feedbackStatus: 'error' }
              : message,
          ),
        );
      }
    },
    [currentPageId, endpointBaseUrl, messages],
  );

  const handleSubmit = async (event?: FormEvent) => {
    event?.preventDefault();
    const question = input.trim();
    if (!question || isLoading) return;

    const userMessage = createMessage('user', question);
    const assistantMessage = createMessage('assistant', '');
    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput('');
    setIsLoading(true);

    const requestBody = JSON.stringify(
      buildAskRequestBody(question, currentPageId, undefined, null, sessionIdRef.current),
    );
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    try {
      const response = await fetch(resolveAskStreamEndpoint(endpointBaseUrl), {
        method: 'POST',
        headers: {
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Content-Type': 'application/json',
        },
        body: requestBody,
        signal: controller.signal,
      });
      const payload = await readAskStreamResponse(response, {
        onDelta: (text) => {
          appendToMessage(assistantMessage.id, text);
        },
      });
      if (isEmptyAskStreamResponse(payload) && !controller.signal.aborted) {
        throw new Error(
          isZh ? '流式连接中断，请重试。' : 'The AI stream was interrupted. Please try again.',
        );
      }

      const next = assistantPayloadFromResponse(payload, lang);
      if (next.sessionId) {
        sessionIdRef.current = next.sessionId;
      }
      replaceMessage(
        assistantMessage.id,
        next.content,
        next.citations,
        next.answerId,
        next.sessionId,
      );
    } catch (error) {
      if (controller.signal.aborted) return;
      const message =
        error instanceof Error
          ? error.message
          : isZh
            ? '网络请求失败'
            : 'Network request failed';
      replaceMessage(
        assistantMessage.id,
        isZh ? `暂时无法回答：${message}` : `Unable to answer right now: ${message}`,
      );
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={isZh ? '询问 AI' : 'Ask AI'}
        className={
          className ??
          'inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[color:var(--docs-divider,var(--fd-border))] bg-white px-3 text-[13px] font-medium text-[color:var(--atlas-top-nav-link,var(--fd-primary))] shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:bg-[color:var(--docs-sidebar-hover,var(--fd-muted))] hover:text-fd-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--atlas-primary,var(--fd-ring))]'
        }
      >
        <Sparkles className="size-4" aria-hidden />
        <span>{isZh ? '问 AI' : 'Ask AI'}</span>
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm sm:p-6">
            <div
              className="relative flex h-full max-h-[760px] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[color:var(--docs-divider,var(--fd-border))] bg-fd-background shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-4 border-b border-[color:var(--docs-divider,var(--fd-border))] bg-[color:var(--atlas-search-background,var(--fd-muted))] px-5 py-4">
                <div className="inline-flex h-10 items-center gap-2 rounded-full bg-[color:var(--atlas-primary,var(--fd-primary))] px-4 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(34,197,94,0.26)]">
                  <Sparkles className="size-5" aria-hidden />
                  <span>Ask AI</span>
                </div>

                <div className="flex min-w-0 items-center">
                  <button
                    type="button"
                    onClick={closeDialog}
                    className="inline-flex size-9 items-center justify-center rounded-lg text-fd-muted-foreground transition hover:bg-fd-accent hover:text-fd-accent-foreground"
                  >
                    <X className="size-5" />
                    <span className="sr-only">{isZh ? '关闭' : 'Close'}</span>
                  </button>
                </div>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto px-5">
                {messages.map((message, index) => (
                  <MessageRow
                    key={message.id}
                    message={message}
                    isIntro={index === 0 && message.role === 'assistant'}
                    isLoadingPlaceholder={
                      isLoading &&
                      message.role === 'assistant' &&
                      message.content.length === 0 &&
                      index === messages.length - 1
                    }
                    isZh={isZh}
                    onFeedback={handleFeedback}
                  />
                ))}
              </div>

              <div className="border-t border-[color:var(--docs-divider,var(--fd-border))] bg-fd-background p-4">
                <form onSubmit={handleSubmit} className="relative flex items-center">
                  <input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder={
                      isZh ? '输入 Cregis 文档问题...' : 'Ask a question about Cregis...'
                    }
                    className="h-14 flex-1 rounded-2xl border border-fd-input bg-[color:var(--atlas-search-background,var(--fd-muted))] px-4 pr-14 text-base shadow-sm transition-colors placeholder:text-fd-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--atlas-primary,var(--fd-ring))]"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className="absolute right-2 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-[color:var(--atlas-primary,var(--fd-primary))] text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <ArrowUp className="size-5" />
                    <span className="sr-only">{isZh ? '发送' : 'Send'}</span>
                  </button>
                </form>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-fd-muted-foreground">
                  <span>{isZh ? 'AI 回答可能不准确。' : 'AI responses may be inaccurate.'}</span>
                  {messages.length > 1 ? (
                    <button
                      type="button"
                      onClick={clearConversation}
                      className="rounded-full border border-[color:var(--docs-divider,var(--fd-border))] px-3 py-1.5 font-medium text-fd-foreground transition hover:bg-fd-accent"
                    >
                      {isZh ? '清空' : 'Clear'}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
