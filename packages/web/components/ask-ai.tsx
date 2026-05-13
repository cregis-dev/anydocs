'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Bot, Send, Sparkles, User, X } from 'lucide-react';

import {
  buildAskRequestBody,
  formatAskResponseMessage,
  resolveAskEndpoint,
  type AskApiResponse,
} from '@/components/ask-ai-api';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type AskAIProps = {
  className?: string;
  currentPageId?: string | null;
  endpointBaseUrl?: string;
  lang?: string;
};

async function readAskResponse(response: Response): Promise<AskApiResponse> {
  const raw = await response.text();
  if (!raw) {
    return {
      type: 'error',
      message: `${response.status} ${response.statusText}`.trim(),
    };
  }

  try {
    return JSON.parse(raw) as AskApiResponse;
  } catch {
    return { type: 'error', message: raw };
  }
}

function createMessage(role: Message['role'], content: string): Message {
  return {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
    role,
    content,
  };
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
  const [messages, setMessages] = useState<Message[]>([
    createMessage(
      'assistant',
      isZh
        ? '你好，我可以根据 Cregis 文档回答问题。'
        : 'Hi, I can answer questions using the Cregis documentation.',
    ),
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSubmit = async (event?: FormEvent) => {
    event?.preventDefault();
    const question = input.trim();
    if (!question || isLoading) return;

    setMessages((prev) => [...prev, createMessage('user', question)]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(resolveAskEndpoint(endpointBaseUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildAskRequestBody(question, currentPageId)),
      });
      const payload = await readAskResponse(response);
      const content = formatAskResponseMessage(payload, lang);
      setMessages((prev) => [...prev, createMessage('assistant', content)]);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : isZh
            ? '网络请求失败'
            : 'Network request failed';
      setMessages((prev) => [
        ...prev,
        createMessage(
          'assistant',
          isZh ? `暂时无法回答：${message}` : `Unable to answer right now: ${message}`,
        ),
      ]);
    } finally {
      setIsLoading(false);
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
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm sm:p-6">
            <div
              className="relative flex h-full max-h-[620px] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[color:var(--docs-divider,var(--fd-border))] bg-fd-background shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-[color:var(--docs-divider,var(--fd-border))] bg-[color:var(--atlas-search-background,var(--fd-muted))] px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Sparkles className="size-5 shrink-0 text-[color:var(--atlas-primary,var(--fd-primary))]" />
                  <span className="truncate font-semibold">
                    {isZh ? 'Cregis AI 助手' : 'Cregis AI Assistant'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md p-1.5 text-fd-muted-foreground transition hover:bg-fd-accent hover:text-fd-accent-foreground"
                >
                  <X className="size-5" />
                  <span className="sr-only">{isZh ? '关闭' : 'Close'}</span>
                </button>
              </div>

              <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${
                      message.role === 'user' ? 'flex-row-reverse' : ''
                    }`}
                  >
                    <div
                      className={`flex size-8 shrink-0 items-center justify-center rounded-full border ${
                        message.role === 'user'
                          ? 'border-[color:var(--atlas-primary,var(--fd-primary))] bg-[color:var(--atlas-primary,var(--fd-primary))] text-white'
                          : 'border-fd-border bg-fd-muted text-fd-foreground'
                      }`}
                    >
                      {message.role === 'user' ? (
                        <User className="size-4" />
                      ) : (
                        <Bot className="size-4" />
                      )}
                    </div>
                    <div
                      className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-6 ${
                        message.role === 'user'
                          ? 'bg-[color:var(--atlas-primary,var(--fd-primary))] text-white'
                          : 'border border-fd-border bg-fd-muted text-fd-foreground'
                      }`}
                    >
                      <div className="whitespace-pre-wrap break-words">{message.content}</div>
                    </div>
                  </div>
                ))}
                {isLoading ? (
                  <div className="flex gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-fd-border bg-fd-muted">
                      <Bot className="size-4 animate-pulse" />
                    </div>
                    <div className="flex items-center gap-1 rounded-2xl border border-fd-border bg-fd-muted px-4 py-3">
                      <span className="size-1.5 animate-bounce rounded-full bg-fd-foreground/50 [animation-delay:-0.3s]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-fd-foreground/50 [animation-delay:-0.15s]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-fd-foreground/50" />
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="border-t border-[color:var(--docs-divider,var(--fd-border))] bg-fd-background p-4">
                <form onSubmit={handleSubmit} className="relative flex items-center">
                  <input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder={
                      isZh ? '输入 Cregis 文档问题...' : 'Ask a question about Cregis...'
                    }
                    className="h-11 flex-1 rounded-xl border border-fd-input bg-fd-background px-4 pr-12 text-sm shadow-sm transition-colors placeholder:text-fd-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--atlas-primary,var(--fd-ring))]"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-[color:var(--atlas-primary,var(--fd-primary))] transition hover:bg-[color:var(--docs-sidebar-hover,var(--fd-muted))] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Send className="size-4" />
                    <span className="sr-only">{isZh ? '发送' : 'Send'}</span>
                  </button>
                </form>
                <div className="mt-2 text-center text-xs text-fd-muted-foreground">
                  {isZh ? 'AI 回答可能不准确。' : 'AI responses may be inaccurate.'}
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
