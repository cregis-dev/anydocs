'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { ArrowUp, BookOpen, Sparkles, ThumbsDown, ThumbsUp, X } from 'lucide-react';

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
import { getAskDisclaimerText } from '@/components/ask-ai-shared';
import { useAskStreamBuffer } from '@/components/use-ask-stream-buffer';

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
  const intro = isZh
    ? '我是根据 Cregis 文档训练的 AI 助手，可以回答支付引擎、WaaS 钱包和 API 接入问题。'
    : 'I am an AI assistant trained on Cregis documentation. Ask me about payments, WaaS wallets, and API integration.';

  return createMessage(
    'assistant',
    `${intro}\n\n${getAskDisclaimerText(isZh)}`,
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
    'block rounded-xl border border-[color:var(--docs-divider,var(--fd-border))] bg-white/70 p-3 transition hover:border-[color:var(--atlas-primary,var(--fd-primary))]/35 hover:bg-white';

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
    <div className="mx-auto flex max-w-[28rem] flex-col items-center text-center">
      <Sparkles className="mb-6 size-[72px] text-[#96999d]" strokeWidth={1.6} />
      <h2 className="mb-3 text-[25px] font-bold leading-8 text-[#020304]">Ask AI</h2>
      <p className="max-w-[28rem] text-[15px] leading-[22px] text-[#020304]">
        {isZh
          ? '我是根据 Cregis 文档训练的 AI 助手，可以回答支付引擎、WaaS 钱包和 API 接入问题。'
          : 'I am trained on Cregis documentation and can answer questions about payments, WaaS wallets, and API integration.'}
      </p>
    </div>
  );
}

function LoadingCopy({ isZh }: { isZh: boolean }) {
  return (
    <div className="flex items-center gap-2 text-[15px] leading-[22px] text-[#7c8086]">
      <Sparkles className="size-4 animate-pulse text-[#96999d]" strokeWidth={1.8} />
      <span>{isZh ? '正在思考...' : 'Thinking...'}</span>
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
  const buttonClass = (rating: AskFeedbackRating) => {
    const active = message.feedbackRating === rating && isSent;
    return [
      'inline-flex size-6 items-center justify-center rounded-md transition',
      active
        ? 'bg-[color:var(--atlas-primary,var(--fd-primary))]/10 text-[color:var(--atlas-primary,var(--fd-primary))]'
        : 'text-[#96999d] hover:bg-black/[0.04] hover:text-[#020304]',
      isSending ? 'cursor-wait opacity-60' : '',
    ].join(' ');
  };

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[#96999d]">
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

  if (isIntro) {
    return (
      <div className="flex min-h-[430px] items-center justify-center px-12 py-10">
        <IntroCopy isZh={isZh} />
      </div>
    );
  }

  return (
    <div className={`flex w-full py-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={
          isUser
            ? 'max-w-[26rem] rounded-xl bg-[#f1f2f3] px-4 py-3 text-[15px] font-semibold leading-[22px] text-[#020304]'
            : 'max-w-[34rem] text-[15px] leading-[22px] text-[#020304]'
        }
      >
        {isUser ? (
          <p>{message.content}</p>
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

  const appendToMessage = useCallback((id: string, text: string) => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === id ? { ...message, content: `${message.content}${text}` } : message,
      ),
    );
  }, []);

  const { appendBufferedText, clearBufferedText } = useAskStreamBuffer(appendToMessage);

  const closeDialog = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    clearBufferedText();
    setIsLoading(false);
    setOpen(false);
  }, [clearBufferedText]);

  const clearConversation = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    clearBufferedText();
    setIsLoading(false);
    setInput('');
    setMessages([createIntroMessage(isZh)]);
    sessionIdRef.current = null;
  }, [clearBufferedText, isZh]);

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
      clearBufferedText();
    };
  }, [clearBufferedText]);

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
          appendBufferedText(assistantMessage.id, text);
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
      clearBufferedText(assistantMessage.id);
      replaceMessage(
        assistantMessage.id,
        next.content,
        next.citations,
        next.answerId,
        next.sessionId,
      );
    } catch (error) {
      if (controller.signal.aborted) return;
      clearBufferedText(assistantMessage.id);
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
      } else {
        clearBufferedText(assistantMessage.id);
      }
    }
  };

  const showIntro = messages.length === 1;

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
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(2,3,4,0.5)] p-4 backdrop-blur-[40px] sm:p-6">
            <div
              className="relative flex h-[min(768px,calc(100dvh-32px))] w-[min(640px,calc(100vw-32px))] flex-col overflow-hidden rounded-[20px] border border-black/10 bg-[#fafbfc] shadow-[0_8px_24px_rgba(2,3,4,0.2)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div
                className={`flex h-10 shrink-0 items-center justify-between px-3 ${
                  showIntro ? '' : 'border-b border-black/[0.08]'
                }`}
              >
                <span
                  className={`pl-2 pt-1 text-[11px] font-bold uppercase leading-[14px] tracking-normal ${
                    showIntro ? 'text-transparent' : 'text-[#7c8086]'
                  }`}
                >
                  Ask AI
                </span>
                <button
                  type="button"
                  onClick={closeDialog}
                  className="inline-flex size-7 items-center justify-center rounded-full text-[#96999d] transition hover:bg-black/[0.06] hover:text-[#020304]"
                >
                  <X className="size-4" />
                  <span className="sr-only">{isZh ? '关闭' : 'Close'}</span>
                </button>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto px-7 py-3">
                {messages.map((message, index) => {
                  const isInitialIntro = index === 0 && message.role === 'assistant';

                  if (!showIntro && isInitialIntro) {
                    return null;
                  }

                  return (
                    <MessageRow
                      key={message.id}
                      message={message}
                      isIntro={showIntro && isInitialIntro}
                      isLoadingPlaceholder={
                        isLoading &&
                        message.role === 'assistant' &&
                        message.content.length === 0 &&
                        index === messages.length - 1
                      }
                      isZh={isZh}
                      onFeedback={handleFeedback}
                    />
                  );
                })}
              </div>

              <div className="shrink-0 bg-[#fafbfc] px-7 pb-4 pt-3">
                <form
                  onSubmit={handleSubmit}
                  className="relative min-h-[102px] rounded-[20px] border border-black/[0.12] bg-white p-4 shadow-[0_6px_16px_rgba(2,3,4,0.03)]"
                >
                  <input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder={
                      isZh ? '输入 Cregis 文档问题...' : 'Ask a question about Cregis...'
                    }
                    className="w-full bg-transparent pr-12 text-[15px] leading-[22px] text-[#020304] placeholder:text-[#96999d] focus-visible:outline-none"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className="absolute bottom-4 right-4 inline-flex size-9 items-center justify-center rounded-full bg-[color:var(--atlas-primary,var(--fd-primary))] text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-[rgba(31,195,90,0.4)]"
                  >
                    <ArrowUp className="size-5" />
                    <span className="sr-only">{isZh ? '发送' : 'Send'}</span>
                  </button>
                </form>
                <div className="mt-3 flex items-start justify-between gap-3 px-6 text-center text-[11px] leading-[14px] text-[#96999d]">
                  <span className="min-w-0 flex-1">{getAskDisclaimerText(isZh)}</span>
                  {messages.length > 1 ? (
                    <button
                      type="button"
                      onClick={clearConversation}
                      className="shrink-0 rounded-full border border-black/[0.12] bg-white px-3 py-1.5 text-xs font-medium text-[#020304] transition hover:bg-black/[0.04]"
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
