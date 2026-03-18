'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X, Send, User, Bot } from 'lucide-react';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export function AskAI({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hi! I am the Cregis AI Assistant. Ask me anything about the documentation!',
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset chat when path changes (optional, maybe keep context?)
  // useEffect(() => {
  //   setMessages([{ id: 'welcome', role: 'assistant', content: 'Hi! I am Cregis AI. Ask me anything about this page!' }]);
  // }, [pathname]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // Mock API response with streaming effect
    setTimeout(() => {
      const botMsgId = (Date.now() + 1).toString();
      const fullResponse = `This is a mock response for: "${userMsg.content}".\n\nI can help you with:\n- API Integration\n- SDK Setup\n- Webhooks\n\n(Backend integration pending)`;
      
      setMessages((prev) => [
        ...prev,
        { id: botMsgId, role: 'assistant', content: '' },
      ]);

      let i = 0;
      const interval = setInterval(() => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === botMsgId
              ? { ...msg, content: fullResponse.slice(0, i + 1) }
              : msg
          )
        );
        i++;
        if (i >= fullResponse.length) {
          clearInterval(interval);
          setIsLoading(false);
        }
      }, 20);
    }, 500);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          'inline-flex h-9 items-center gap-2 rounded-full border border-fd-border bg-fd-card px-3 text-sm font-medium text-fd-primary shadow-sm transition hover:bg-fd-muted'
        }
      >
        <Sparkles className="size-4" />
        <span className="hidden sm:inline">Ask AI</span>
        <kbd className="hidden rounded-md border border-fd-border bg-fd-muted px-1.5 py-0.5 text-[10px] font-semibold text-fd-muted-foreground sm:inline-block">
          ⌘K
        </kbd>
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[50] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6 md:p-8">
            <div
              className="relative flex h-full max-h-[600px] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-fd-border bg-fd-background shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-fd-border px-4 py-3 bg-fd-muted/50">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-5 text-primary" />
                  <span className="font-semibold">Cregis AI Assistant</span>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-md p-1 hover:bg-fd-accent hover:text-fd-accent-foreground"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${
                      msg.role === 'user' ? 'flex-row-reverse' : ''
                    }`}
                  >
                    <div
                      className={`flex size-8 shrink-0 items-center justify-center rounded-full border ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted border-border'
                      }`}
                    >
                      {msg.role === 'user' ? (
                        <User className="size-5" />
                      ) : (
                        <Bot className="size-5" />
                      )}
                    </div>
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground border border-border'
                      }`}
                    >
                      <div className="prose prose-sm dark:prose-invert whitespace-pre-wrap">
                        {msg.content}
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && messages[messages.length - 1].role === 'user' && (
                   <div className="flex gap-3">
                     <div className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-muted border-border">
                       <Bot className="size-5 animate-pulse" />
                     </div>
                     <div className="flex items-center gap-1 rounded-lg border border-border bg-muted px-4 py-2">
                       <span className="size-1.5 rounded-full bg-foreground/50 animate-bounce [animation-delay:-0.3s]"></span>
                       <span className="size-1.5 rounded-full bg-foreground/50 animate-bounce [animation-delay:-0.15s]"></span>
                       <span className="size-1.5 rounded-full bg-foreground/50 animate-bounce"></span>
                     </div>
                   </div>
                )}
              </div>

              {/* Input */}
              <div className="border-t border-fd-border p-4 bg-fd-background">
                <form
                  onSubmit={handleSubmit}
                  className="relative flex items-center"
                >
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask a question about Cregis..."
                    className="flex-1 rounded-lg border border-fd-input bg-fd-background px-4 py-2.5 pr-12 text-sm shadow-sm transition-colors placeholder:text-fd-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-primary hover:bg-primary/10 disabled:opacity-50"
                  >
                    <Send className="size-4" />
                  </button>
                </form>
                <div className="mt-2 text-center text-xs text-fd-muted-foreground">
                  AI responses may be inaccurate.
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
