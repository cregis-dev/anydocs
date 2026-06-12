"use client";

import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  ArrowUp,
  BookOpen,
  FileText,
  Hash,
  Search,
  Sparkles,
  User,
} from "lucide-react";

import {
  buildAskRequestBody,
  isEmptyAskStreamResponse,
  readAskStreamResponse,
  resolveAskStreamEndpoint,
  type AskApiClarifyOption,
  type AskApiCitation,
} from "@/components/ask-ai-api";
import {
  assistantPayloadFromResponse,
  citationNumber,
  citationPath,
  createAskMessage,
  getDocumentationName,
  type AskMessage,
} from "@/components/ask-ai-shared";
import { useAskStreamBuffer } from "@/components/use-ask-stream-buffer";
import { getDocsUiCopy } from "@/components/docs/docs-ui-copy";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  type LoadedReaderSearchIndex,
  loadPreferredReaderSearchIndex,
  searchReaderIndex,
} from "@/lib/docs/search";
import { cn } from "@/lib/utils";

const AskAIMarkdown = dynamic(() =>
  import("@/components/ask-ai-markdown").then((module) => module.AskAIMarkdown),
);

type Mode = "search" | "ask";

function getHighlightTerms(query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) {
    return [];
  }

  const terms = new Set<string>([normalized]);

  for (const token of normalized.match(/[\p{L}\p{N}]+/gu) ?? []) {
    if (
      token.length > 1 ||
      /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(token)
    ) {
      terms.add(token);
    }
  }

  return [...terms].sort((left, right) => right.length - left.length);
}

function renderHighlightedText(
  text: string,
  terms: string[],
  className?: string,
): ReactNode {
  if (!terms.length) {
    return <span className={className}>{text}</span>;
  }

  const normalizedText = text.toLocaleLowerCase();
  const pieces: Array<{ text: string; isMatch: boolean }> = [];
  let cursor = 0;

  while (cursor < text.length) {
    let nextMatchIndex = -1;
    let nextMatchTerm = "";

    for (const term of terms) {
      const matchIndex = normalizedText.indexOf(term, cursor);
      if (matchIndex < 0) {
        continue;
      }

      if (
        nextMatchIndex < 0 ||
        matchIndex < nextMatchIndex ||
        (matchIndex === nextMatchIndex && term.length > nextMatchTerm.length)
      ) {
        nextMatchIndex = matchIndex;
        nextMatchTerm = term;
      }
    }

    if (nextMatchIndex < 0) {
      pieces.push({ text: text.slice(cursor), isMatch: false });
      break;
    }

    if (nextMatchIndex > cursor) {
      pieces.push({ text: text.slice(cursor, nextMatchIndex), isMatch: false });
    }

    const nextCursor = nextMatchIndex + nextMatchTerm.length;
    pieces.push({
      text: text.slice(nextMatchIndex, nextCursor),
      isMatch: true,
    });
    cursor = nextCursor;
  }

  return (
    <span className={className}>
      {pieces.map((piece, index) => {
        if (!piece.isMatch) {
          return <span key={`${piece.text}-${index}`}>{piece.text}</span>;
        }

        return (
          <mark
            key={`${piece.text}-${index}`}
            className="rounded-[0.35rem] bg-[rgba(251,191,36,0.26)] px-0.5 text-inherit"
          >
            {piece.text}
          </mark>
        );
      })}
    </span>
  );
}

function SourceList({
  citations,
  isZh,
}: {
  citations: AskApiCitation[];
  isZh: boolean;
}) {
  if (citations.length === 0) return null;

  return (
    <div className="mt-5">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-fd-muted-foreground">
        {isZh ? "参考来源" : "Sources"}
      </div>
      <div className="space-y-2">
        {citations.map((citation, index) => {
          const body = (
            <>
              <div className="mb-1.5 flex items-center gap-2 text-xs text-fd-muted-foreground">
                <span className="inline-flex size-5 items-center justify-center rounded-md bg-[color:color-mix(in_srgb,var(--ask-ai-primary,var(--fd-primary))_10%,white)] text-[11px] font-semibold text-[color:var(--ask-ai-primary,var(--fd-primary))]">
                  {citationNumber(citation, index)}
                </span>
                <span className="truncate">{citationPath(citation)}</span>
              </div>
              <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-fd-foreground">
                <BookOpen className="size-4 shrink-0 text-[color:var(--ask-ai-primary,var(--fd-primary))]" />
                <span className="truncate">{citation.title}</span>
              </div>
            </>
          );
          const className =
            "block rounded-lg border border-[color:var(--docs-divider,var(--fd-border))] bg-[color:var(--ask-ai-panel-subtle,var(--fd-muted))] p-3 transition hover:bg-[color:var(--docs-sidebar-hover,var(--fd-muted))]";

          return citation.url ? (
            <a
              key={`${citation.citation_id}-${citation.url}-${index}`}
              href={citation.url}
              className={className}
            >
              {body}
            </a>
          ) : (
            <div
              key={`${citation.citation_id}-${citation.title}-${index}`}
              className={className}
            >
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ClarifyOptions({
  options,
  selectedScopeId,
  disabled,
  isZh,
  onSelect,
}: {
  options: AskApiClarifyOption[];
  selectedScopeId?: string;
  disabled: boolean;
  isZh: boolean;
  onSelect: (option: AskApiClarifyOption) => void;
}) {
  if (options.length === 0) return null;

  return (
    <div className="mt-4 space-y-2">
      {options.map((option) => {
        const breadcrumb =
          option.breadcrumb
            ?.map((item) => item.title)
            .filter(Boolean)
            .join(" / ") ?? "";
        const samples =
          option.sample_pages
            ?.map((page) => page.title)
            .filter(Boolean)
            .slice(0, 2)
            .join(" · ") ?? "";
        const isSelected = selectedScopeId === option.scope_id;

        return (
          <button
            key={option.scope_id}
            type="button"
            disabled={disabled || Boolean(selectedScopeId)}
            onClick={() => onSelect(option)}
            className={cn(
              "block w-full rounded-xl border border-[color:var(--docs-divider,var(--fd-border))] bg-[color:var(--ask-ai-panel-subtle,var(--fd-muted))] px-4 py-3 text-left transition hover:border-[color:var(--ask-ai-primary,var(--fd-primary))] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ask-ai-ring,var(--fd-ring))] disabled:cursor-default disabled:opacity-70",
              isSelected &&
                "border-[color:var(--ask-ai-primary,var(--fd-primary))] bg-white shadow-[0_0_0_1px_color-mix(in_srgb,var(--ask-ai-primary,var(--fd-primary))_22%,transparent)]",
            )}
          >
            <span className="block text-[14px] font-semibold text-fd-foreground">
              {isZh ? "继续在 " : "Continue under "}
              {option.label}
            </span>
            {breadcrumb ? (
              <span className="mt-1 block truncate text-xs text-fd-muted-foreground">
                {breadcrumb}
              </span>
            ) : null}
            {samples ? (
              <span className="mt-1 block truncate text-xs text-fd-muted-foreground">
                {samples}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function AskIntro({
  documentationName,
  isZh,
}: {
  documentationName: string;
  isZh: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--docs-divider,var(--fd-border))] bg-white/80 p-5">
      <div className="mb-3 inline-flex size-10 items-center justify-center rounded-full border border-[color:var(--docs-divider,var(--fd-border))] bg-[color:var(--ask-ai-panel-subtle,var(--fd-muted))] text-[color:var(--ask-ai-primary,var(--fd-primary))]">
        <Sparkles className="size-5" />
      </div>
      <p className="text-[15px] leading-7 text-fd-foreground">
        {isZh
          ? `可以向 AI 提问，它会基于 ${documentationName} 已发布文档内容回答。`
          : `Ask AI questions grounded in the published ${documentationName} documentation.`}
      </p>
    </div>
  );
}

function AskConversation({
  messages,
  isLoading,
  documentationName,
  isZh,
  onClarifySelect,
}: {
  messages: AskMessage[];
  isLoading: boolean;
  documentationName: string;
  isZh: boolean;
  onClarifySelect: (message: AskMessage, option: AskApiClarifyOption) => void;
}) {
  if (messages.length === 0) {
    return <AskIntro documentationName={documentationName} isZh={isZh} />;
  }

  return (
    <div className="space-y-4">
      {messages.map((message, index) => {
        const isUser = message.role === "user";
        const isLoadingPlaceholder =
          isLoading &&
          message.role === "assistant" &&
          message.content.length === 0 &&
          index === messages.length - 1;

        return (
          <div
            key={message.id}
            className="grid grid-cols-[2.5rem_1fr] gap-3 rounded-2xl border border-[color:var(--docs-divider,var(--fd-border))] bg-white/80 p-4"
          >
            <div
              className={cn(
                "flex size-10 items-center justify-center rounded-full",
                isUser
                  ? "bg-[color:var(--ask-ai-primary,var(--fd-primary))] text-[color:var(--ask-ai-primary-foreground,var(--fd-primary-foreground))]"
                  : "border border-[color:var(--docs-divider,var(--fd-border))] bg-[color:var(--ask-ai-panel-subtle,var(--fd-muted))] text-[color:var(--ask-ai-primary,var(--fd-primary))]",
              )}
            >
              {isUser ? <User className="size-5" /> : <Sparkles className="size-5" />}
            </div>
            <div className="min-w-0 pt-1">
              {isUser ? (
                <p className="text-[15px] font-medium leading-7 text-fd-foreground">
                  {message.content}
                </p>
              ) : message.content.length > 0 ? (
                <>
                  <AskAIMarkdown content={message.content} />
                  <ClarifyOptions
                    options={message.clarifyOptions ?? []}
                    selectedScopeId={message.selectedClarifyScopeId}
                    disabled={isLoading}
                    isZh={isZh}
                    onSelect={(option) => onClarifySelect(message, option)}
                  />
                  <SourceList citations={message.citations ?? []} isZh={isZh} />
                </>
              ) : isLoadingPlaceholder ? (
                <div className="flex items-center gap-2 text-sm text-fd-muted-foreground">
                  <span>
                    {isZh ? `正在查询 ${documentationName}` : `Searching ${documentationName}`}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="size-1.5 animate-bounce rounded-full bg-[color:var(--ask-ai-primary,var(--fd-primary))] [animation-delay:-0.3s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-[color:var(--ask-ai-primary,var(--fd-primary))] [animation-delay:-0.15s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-[color:var(--ask-ai-primary,var(--fd-primary))]" />
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SearchAskPanel({
  lang,
  findHref,
  indexHref,
  currentPageId,
  documentationName,
  endpointBaseUrl,
  portalClassName,
  className,
  inputClassName,
  triggerTextClassName,
  shortcutClassName,
  resultsClassName,
}: {
  lang: "zh" | "en";
  findHref?: string;
  indexHref?: string;
  currentPageId?: string | null;
  documentationName?: string;
  endpointBaseUrl?: string;
  portalClassName?: string;
  className?: string;
  inputClassName?: string;
  triggerTextClassName?: string;
  shortcutClassName?: string;
  resultsClassName?: string;
}) {
  const isZh = lang === "zh";
  const docsName = getDocumentationName(documentationName, isZh);
  const copy = getDocsUiCopy(lang);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("search");
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState<LoadedReaderSearchIndex | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [askMessages, setAskMessages] = useState<AskMessage[]>([]);
  const [isAskLoading, setIsAskLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const askSessionIdRef = useRef<string | null>(null);

  const triggerLabel = isZh ? "搜索 / 问 AI" : "Search / Ask AI";
  const searchPlaceholder = copy.sidebar.searchPlaceholder;
  const askPlaceholder = isZh ? `询问 ${docsName}...` : `Ask about ${docsName}...`;
  const resolvedPlaceholder = mode === "ask" ? askPlaceholder : searchPlaceholder;

  const shortcutLabel =
    typeof navigator !== "undefined" &&
    /mac|iphone|ipad|ipod/i.test(navigator.platform)
      ? "⌘K"
      : "Ctrl K";

  const appendToAskMessage = useCallback((id: string, text: string) => {
    setAskMessages((prev) =>
      prev.map((message) =>
        message.id === id ? { ...message, content: `${message.content}${text}` } : message,
      ),
    );
  }, []);

  const { appendBufferedText, clearBufferedText } = useAskStreamBuffer(appendToAskMessage);

  const closeDialog = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    clearBufferedText();
    setIsAskLoading(false);
    setOpen(false);
  }, [clearBufferedText]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      closeDialog();
      setQ("");
      setActiveIndex(-1);
      return;
    }

    setOpen(true);
  };

  const openWithSeed = (seed = "") => {
    setQ(seed);
    setOpen(true);
  };

  useEffect(() => {
    let cancelled = false;
    loadPreferredReaderSearchIndex(lang, { findHref, indexHref })
      .then((data) => {
        if (cancelled) return;
        setIdx(data);
      })
      .catch(() => {
        if (cancelled) return;
        setIdx(null);
      });

    return () => {
      cancelled = true;
    };
  }, [findHref, indexHref, lang]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [mode, open]);

  useEffect(() => {
    function onGlobalShortcut(event: KeyboardEvent) {
      const target = event.target;
      const isEditable =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (isEditable) {
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openWithSeed();
      }
    }

    window.addEventListener("keydown", onGlobalShortcut);
    return () => {
      window.removeEventListener("keydown", onGlobalShortcut);
    };
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      clearBufferedText();
    };
  }, [clearBufferedText]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [askMessages]);

  const results = useMemo(() => {
    const query = q.trim();
    if (!idx || !query) return [];
    return searchReaderIndex(
      idx.index,
      query,
      lang,
      idx.source,
      idx.config,
    ).slice(0, 12);
  }, [idx, lang, q]);
  const highlightTerms = useMemo(() => getHighlightTerms(q), [q]);
  const resolvedActiveIndex =
    !q.trim() || results.length === 0
      ? -1
      : activeIndex >= 0 && activeIndex < results.length
        ? activeIndex
        : 0;

  useEffect(() => {
    if (mode !== "search" || resolvedActiveIndex < 0) {
      return;
    }

    itemRefs.current[resolvedActiveIndex]?.scrollIntoView({
      block: "nearest",
    });
  }, [mode, resolvedActiveIndex]);

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openWithSeed();
      return;
    }

    if (
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.key.length !== 1
    ) {
      return;
    }

    event.preventDefault();
    openWithSeed(event.key);
  }

  function handleSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (mode !== "search" || !results.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % results.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        current <= 0 ? results.length - 1 : current - 1,
      );
      return;
    }

    if (event.key === "Enter") {
      const result = results[resolvedActiveIndex] ?? results[0];
      if (!result) return;
      event.preventDefault();
      handleOpenChange(false);
      router.push(result.href ?? `/${lang}/${result.slug}`);
    }
  }

  const replaceAskMessage = (
    id: string,
    content: string,
    citations: AskApiCitation[] = [],
    clarifyOptions: AskApiClarifyOption[] = [],
    clarifyQuestion?: string,
  ) => {
    setAskMessages((prev) =>
      prev.map((message) =>
        message.id === id
          ? { ...message, content, citations, clarifyOptions, clarifyQuestion }
          : message,
      ),
    );
  };

  const runAskRequest = async (
    question: string,
    options: {
      scopeId?: string;
      displayQuestion?: string;
      markClarifyMessageId?: string;
    } = {},
  ) => {
    if (!question || isAskLoading) return;

    if (options.markClarifyMessageId && options.scopeId) {
      setAskMessages((prev) =>
        prev.map((message) =>
          message.id === options.markClarifyMessageId
            ? { ...message, selectedClarifyScopeId: options.scopeId }
            : message,
        ),
      );
    }

    const userMessage = createAskMessage("user", options.displayQuestion ?? question);
    const assistantMessage = createAskMessage("assistant", "");
    setAskMessages((prev) => [...prev, userMessage, assistantMessage]);
    setQ("");
    setIsAskLoading(true);

    const requestBody = JSON.stringify(
      buildAskRequestBody(
        question,
        options.scopeId ? null : currentPageId,
        undefined,
        options.scopeId,
        askSessionIdRef.current,
      ),
    );
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    try {
      const response = await fetch(resolveAskStreamEndpoint(endpointBaseUrl), {
        method: "POST",
        headers: {
          Accept: "text/event-stream",
          "Content-Type": "application/json",
          // SSE responses must bypass CDN/proxy caches that would otherwise
          // buffer or cache the first chunk and break streaming.
          "Cache-Control": "no-cache",
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
          isZh ? "流式连接中断，请重试。" : "The AI stream was interrupted. Please try again.",
        );
      }

      const next = assistantPayloadFromResponse(payload, lang);
      if (payload.session_id) {
        askSessionIdRef.current = payload.session_id;
      }
      clearBufferedText(assistantMessage.id);
      replaceAskMessage(
        assistantMessage.id,
        next.content,
        next.citations,
        next.clarifyOptions,
        payload.type === "clarify" ? question : undefined,
      );
    } catch (error) {
      if (controller.signal.aborted) return;
      clearBufferedText(assistantMessage.id);
      const message =
        error instanceof Error
          ? error.message
          : isZh
            ? "网络请求失败"
            : "Network request failed";
      replaceAskMessage(
        assistantMessage.id,
        isZh ? `暂时无法回答：${message}` : `Unable to answer right now: ${message}`,
      );
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      if (!controller.signal.aborted) {
        setIsAskLoading(false);
      } else {
        clearBufferedText(assistantMessage.id);
      }
    }
  };

  const handleAskSubmit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (mode !== "ask") return;

    const question = q.trim();
    await runAskRequest(question);
  };

  const handleClarifySelect = async (
    message: AskMessage,
    option: AskApiClarifyOption,
  ) => {
    const question = message.clarifyQuestion?.trim();
    if (!question || isAskLoading || message.selectedClarifyScopeId) return;

    await runAskRequest(question, {
      scopeId: option.scope_id,
      displayQuestion: isZh ? `选择：${option.label}` : `Selected: ${option.label}`,
      markClarifyMessageId: message.id,
    });
  };

  return (
    <div className={cn("w-full", className)}>
      <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
        <DialogPrimitive.Trigger asChild>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={triggerLabel}
            className={cn(
              "flex h-10 w-full items-center gap-3 rounded-lg border border-[color:var(--docs-search-border,var(--fd-border))] bg-[color:var(--docs-search-background,var(--fd-muted))] px-4 text-left text-sm text-[color:var(--docs-body-copy,var(--fd-foreground))] shadow-none transition-colors hover:border-[color:var(--docs-search-border,var(--fd-border))] hover:bg-[color:var(--docs-search-results-background,var(--fd-card))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ask-ai-ring,var(--fd-ring))]",
              inputClassName,
            )}
            onClick={() => openWithSeed()}
            onKeyDown={handleTriggerKeyDown}
          >
            <Search className="h-4 w-4 shrink-0 text-[color:var(--docs-search-placeholder,var(--fd-muted-foreground))]" />
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-[color:var(--docs-search-placeholder,var(--fd-muted-foreground))]",
                triggerTextClassName,
              )}
            >
              {triggerLabel}
            </span>
            <Sparkles className="h-4 w-4 shrink-0 text-[color:var(--ask-ai-primary,var(--fd-primary))]" />
            <span
              className={cn(
                "hidden shrink-0 rounded-md border border-[rgba(15,23,42,0.08)] bg-white/80 px-2 py-1 text-[11px] font-medium tracking-[0.02em] text-[color:var(--docs-body-copy-subtle,var(--fd-muted-foreground))] sm:inline-flex",
                shortcutClassName,
              )}
            >
              {shortcutLabel}
            </span>
          </button>
        </DialogPrimitive.Trigger>

        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgba(15,23,42,0.40)] backdrop-blur-[6px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            className={cn(
              "fixed left-1/2 top-[9vh] z-50 flex max-h-[82vh] w-[min(92vw,52rem)] -translate-x-1/2 flex-col overflow-hidden rounded-[24px] border border-[rgba(15,23,42,0.08)] bg-[color:var(--docs-search-results-background,var(--fd-card))] shadow-[0_32px_80px_rgba(15,23,42,0.22)] outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
              portalClassName,
              resultsClassName,
            )}
          >
            <DialogTitle className="sr-only">{triggerLabel}</DialogTitle>
            <DialogDescription className="sr-only">
              {isZh
                ? "搜索文档内容，或向 AI 提问。"
                : "Search documentation content, or ask AI a question."}
            </DialogDescription>

            <div className="border-b border-[rgba(15,23,42,0.08)] bg-[color:var(--ask-ai-header,var(--fd-muted))] px-4 py-4 sm:px-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-[15px] font-semibold text-fd-foreground">
                  <Search className="size-4 text-[color:var(--docs-search-placeholder,var(--fd-muted-foreground))]" />
                  <span>{triggerLabel}</span>
                </div>
                <div className="inline-flex rounded-lg border border-[color:var(--docs-divider,var(--fd-border))] bg-white/80 p-1">
                  {(["search", "ask"] as const).map((nextMode) => {
                    const active = mode === nextMode;
                    return (
                      <button
                        key={nextMode}
                        type="button"
                        onClick={() => {
                          setMode(nextMode);
                          setActiveIndex(-1);
                        }}
                        className={cn(
                          "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition",
                          active
                            ? "bg-[color:var(--ask-ai-primary,var(--fd-primary))] text-[color:var(--ask-ai-primary-foreground,var(--fd-primary-foreground))] shadow-sm"
                            : "text-fd-muted-foreground hover:bg-fd-muted hover:text-fd-foreground",
                        )}
                      >
                        {nextMode === "search" ? (
                          <Search className="size-3.5" />
                        ) : (
                          <Sparkles className="size-3.5" />
                        )}
                        <span>
                          {nextMode === "search"
                            ? isZh
                              ? "搜索"
                              : "Search"
                            : isZh
                              ? "问 AI"
                              : "Ask AI"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <form onSubmit={handleAskSubmit} className="flex items-center gap-3">
                {mode === "ask" ? (
                  <Sparkles className="h-5 w-5 shrink-0 text-[color:var(--ask-ai-primary,var(--fd-primary))]" />
                ) : (
                  <Search className="h-5 w-5 shrink-0 text-[color:var(--docs-search-placeholder,var(--fd-muted-foreground))]" />
                )}
                <Input
                  ref={inputRef}
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder={resolvedPlaceholder}
                  aria-label={resolvedPlaceholder}
                  className="h-auto border-0 bg-transparent px-0 py-0 text-[20px] font-medium tracking-[-0.02em] text-[color:var(--docs-body-copy,var(--fd-foreground))] shadow-none placeholder:text-[color:var(--docs-search-placeholder,var(--fd-muted-foreground))] focus-visible:ring-0"
                />
                {mode === "ask" ? (
                  <button
                    type="submit"
                    disabled={!q.trim() || isAskLoading}
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--ask-ai-primary,var(--fd-primary))] text-[color:var(--ask-ai-primary-foreground,var(--fd-primary-foreground))] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <ArrowUp className="size-5" />
                    <span className="sr-only">{isZh ? "发送" : "Send"}</span>
                  </button>
                ) : (
                  <DialogPrimitive.Close asChild>
                    <button
                      type="button"
                      className="inline-flex h-10 shrink-0 items-center rounded-xl border border-[rgba(15,23,42,0.08)] bg-white px-3 text-[12px] font-semibold text-[color:var(--docs-body-copy,var(--fd-foreground))] shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:bg-[color:var(--docs-search-background,var(--fd-muted))]"
                    >
                      <span aria-hidden="true">Esc</span>
                      <span className="sr-only">{copy.search.close}</span>
                    </button>
                  </DialogPrimitive.Close>
                )}
              </form>
            </div>

            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
              {mode === "ask" ? (
                <div className="space-y-3">
                  <AskConversation
                    messages={askMessages}
                    isLoading={isAskLoading}
                    documentationName={docsName}
                    isZh={isZh}
                    onClarifySelect={handleClarifySelect}
                  />
                  <div className="flex items-center justify-between gap-3 px-1 text-xs text-fd-muted-foreground">
                    <span>{isZh ? "AI 回答可能不准确。" : "AI responses may be inaccurate."}</span>
                    {askMessages.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          abortRef.current?.abort();
                          abortRef.current = null;
                          clearBufferedText();
                          setIsAskLoading(false);
                          setAskMessages([]);
                          askSessionIdRef.current = null;
                        }}
                        className="rounded-full border border-[color:var(--docs-divider,var(--fd-border))] px-3 py-1.5 font-medium text-fd-foreground transition hover:bg-fd-accent"
                      >
                        {isZh ? "清空" : "Clear"}
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : !q.trim() ? (
                <div className="space-y-4 rounded-[20px] border border-[rgba(15,23,42,0.06)] bg-white/80 px-5 py-5">
                  <div>
                    <div className="text-[15px] font-semibold text-fd-foreground">
                      {copy.search.startTyping}
                    </div>
                    <div className="mt-1 text-sm leading-6 text-[color:var(--docs-body-copy-subtle,var(--fd-muted-foreground))]">
                      {copy.sidebar.searchHint}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-[color:var(--docs-body-copy-subtle,var(--fd-muted-foreground))]">
                    <span className="rounded-full border border-[rgba(15,23,42,0.08)] bg-white px-3 py-1.5">
                      {copy.search.pagesLabel}
                    </span>
                    <span className="rounded-full border border-[rgba(15,23,42,0.08)] bg-white px-3 py-1.5">
                      {copy.search.sectionsLabel}
                    </span>
                    <span className="rounded-full border border-[rgba(15,23,42,0.08)] bg-white px-3 py-1.5">
                      {copy.search.contentLabel}
                    </span>
                  </div>
                </div>
              ) : !idx ? (
                <div className="space-y-3 rounded-[20px] border border-[rgba(15,23,42,0.06)] bg-white/80 px-5 py-5">
                  <div className="text-sm text-[color:var(--docs-body-copy-subtle,var(--fd-muted-foreground))]">
                    {copy.search.loading}
                  </div>
                  <div className="space-y-2">
                    <div className="h-16 rounded-[18px] bg-[linear-gradient(90deg,rgba(15,23,42,0.04),rgba(15,23,42,0.08),rgba(15,23,42,0.04))]" />
                    <div className="h-16 rounded-[18px] bg-[linear-gradient(90deg,rgba(15,23,42,0.03),rgba(15,23,42,0.07),rgba(15,23,42,0.03))]" />
                  </div>
                </div>
              ) : results.length ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1 text-xs font-medium uppercase tracking-[0.04em] text-[color:var(--docs-body-copy-subtle,var(--fd-muted-foreground))]">
                    <span>{copy.search.bestMatch}</span>
                    <span>
                      {results.length} {copy.search.resultsLabel}
                    </span>
                  </div>
                  <div
                    aria-live="polite"
                    className="space-y-2 rounded-[20px] border border-[rgba(15,23,42,0.06)] bg-white/88 p-2"
                  >
                    {results.map((result, index) => {
                      const meta = [
                        result.breadcrumbs?.length
                          ? result.breadcrumbs.join(" / ")
                          : "",
                        result.sectionTitle && result.sectionTitle !== result.title
                          ? result.sectionTitle
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" · ");
                      const isActive = resolvedActiveIndex === index;
                      const isSectionResult = Boolean(
                        result.sectionTitle && result.sectionTitle !== result.title,
                      );
                      const href = result.href ?? `/${lang}/${result.slug}`;
                      const bodyText =
                        result.snippet ??
                        result.text ??
                        result.description ??
                        "";

                      return (
                        <Link
                          key={result.id}
                          href={href}
                          ref={(node) => {
                            itemRefs.current[index] = node;
                          }}
                          aria-selected={isActive}
                          className={cn(
                            "group relative flex items-start gap-3 rounded-[16px] px-3 py-3 transition",
                            isActive
                              ? "bg-[color:var(--docs-search-background,var(--fd-muted))] shadow-[inset_0_0_0_1px_rgba(15,23,42,0.04)]"
                              : "hover:bg-[color:var(--docs-search-background,var(--fd-muted))]",
                            isSectionResult &&
                              "ml-3 pl-5 before:absolute before:bottom-3 before:left-0 before:top-3 before:w-px before:bg-[rgba(15,23,42,0.10)]",
                          )}
                          onClick={() => handleOpenChange(false)}
                          onMouseEnter={() => setActiveIndex(index)}
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--docs-search-background,var(--fd-muted))] text-[color:var(--docs-search-placeholder,var(--fd-muted-foreground))]",
                              isActive && "bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)]",
                            )}
                          >
                            {isSectionResult ? (
                              <Hash className="h-4 w-4" />
                            ) : (
                              <FileText className="h-4 w-4" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="block truncate text-[15px] font-semibold tracking-[-0.015em] text-fd-foreground">
                                {renderHighlightedText(result.title, highlightTerms)}
                              </span>
                              {index === 0 ? (
                                <span className="hidden rounded-full border border-[rgba(15,23,42,0.08)] bg-white px-2 py-0.5 text-[10px] font-semibold tracking-[0.05em] text-[color:var(--docs-body-copy-subtle,var(--fd-muted-foreground))] sm:inline-flex">
                                  {copy.search.bestMatch}
                                </span>
                              ) : null}
                            </span>
                            {meta ? (
                              <span className="mt-1 block truncate text-xs text-[color:var(--docs-body-copy-subtle,var(--fd-muted-foreground))]">
                                {renderHighlightedText(meta, highlightTerms)}
                              </span>
                            ) : null}
                            {bodyText ? (
                              <span className="mt-1.5 block text-[13px] leading-5 text-[color:var(--docs-body-copy-subtle,var(--fd-muted-foreground))] [display:-webkit-box] [overflow:hidden] [WebkitBoxOrient:vertical] [WebkitLineClamp:2]">
                                {renderHighlightedText(bodyText, highlightTerms)}
                              </span>
                            ) : null}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-3 rounded-[20px] border border-[rgba(15,23,42,0.06)] bg-white/88 px-5 py-5">
                  <div className="text-[15px] font-semibold text-fd-foreground">
                    {copy.search.noResults}
                  </div>
                  <div className="text-sm leading-6 text-[color:var(--docs-body-copy-subtle,var(--fd-muted-foreground))]">
                    {copy.search.noResultsHint}
                  </div>
                  <Link
                    href={`/${lang}`}
                    onClick={() => handleOpenChange(false)}
                    className="inline-flex rounded-full border border-fd-border px-3 py-1.5 text-xs font-medium text-fd-foreground transition hover:bg-fd-muted"
                  >
                    {copy.search.browseHome}
                  </Link>
                </div>
              )}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}
