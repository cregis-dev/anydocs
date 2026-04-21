"use client";

import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Hash, Search } from "lucide-react";

import { getDocsUiCopy } from "@/components/docs/docs-ui-copy";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  type LoadedReaderSearchIndex,
  loadPreferredReaderSearchIndex,
  searchReaderIndex,
} from "@/lib/docs/search";
import { cn } from "@/lib/utils";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

  const matcher = new RegExp(`(${terms.map(escapeRegex).join("|")})`, "giu");
  const pieces = text.split(matcher).filter(Boolean);

  return (
    <span className={className}>
      {pieces.map((piece, index) => {
        const isMatch = terms.some(
          (term) => piece.toLocaleLowerCase() === term,
        );
        if (!isMatch) {
          return <span key={`${piece}-${index}`}>{piece}</span>;
        }

        return (
          <mark
            key={`${piece}-${index}`}
            className="rounded-[0.35rem] bg-[rgba(251,191,36,0.26)] px-0.5 text-inherit"
          >
            {piece}
          </mark>
        );
      })}
    </span>
  );
}

export function SearchPanel({
  lang,
  findHref,
  indexHref,
  triggerLabel,
  placeholder,
  className,
  inputClassName,
  triggerTextClassName,
  shortcutClassName,
  resultsClassName,
}: {
  lang: "zh" | "en";
  findHref?: string;
  indexHref?: string;
  triggerLabel?: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  triggerTextClassName?: string;
  shortcutClassName?: string;
  resultsClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState<LoadedReaderSearchIndex | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const router = useRouter();
  const copy = getDocsUiCopy(lang);
  const resolvedPlaceholder = placeholder ?? copy.sidebar.searchPlaceholder;
  const resolvedTriggerLabel =
    triggerLabel ?? copy.sidebar.searchTriggerLabel ?? resolvedPlaceholder;

  const shortcutLabel =
    typeof navigator !== "undefined" &&
    /mac|iphone|ipad|ipod/i.test(navigator.platform)
      ? "⌘K"
      : "Ctrl K";

  const openWithSeed = (seed = "") => {
    setQ(seed);
    setOpen(true);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setQ("");
      setActiveIndex(-1);
    }
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
  }, [open]);

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
    if (resolvedActiveIndex < 0) {
      return;
    }

    itemRefs.current[resolvedActiveIndex]?.scrollIntoView({
      block: "nearest",
    });
  }, [resolvedActiveIndex]);

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
    if (!results.length) return;

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

  return (
    <div className={cn("w-full", className)}>
      <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
        <DialogPrimitive.Trigger asChild>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={resolvedPlaceholder}
            className={cn(
              "flex h-10 w-full items-center gap-3 rounded-lg border border-[color:var(--docs-search-border,var(--fd-border))] bg-[color:var(--docs-search-background,var(--fd-muted))] px-4 text-left text-sm text-[color:var(--docs-body-copy,var(--fd-foreground))] shadow-none transition-colors hover:border-[color:var(--docs-search-border,var(--fd-border))] hover:bg-[color:var(--docs-search-results-background,var(--fd-card))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(59,130,246,0.18)]",
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
              {resolvedTriggerLabel}
            </span>
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
          <DialogPrimitive.Content className="fixed left-1/2 top-[12vh] z-50 w-[min(92vw,52rem)] -translate-x-1/2 rounded-[28px] border border-[rgba(15,23,42,0.08)] bg-[color:var(--docs-search-results-background,var(--fd-card))] shadow-[0_32px_80px_rgba(15,23,42,0.22)] outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
            <DialogTitle className="sr-only">
              {copy.search.dialogTitle}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {copy.search.dialogDescription}
            </DialogDescription>

            <div className="overflow-hidden rounded-[inherit]">
              <div className="flex items-center gap-3 border-b border-[rgba(15,23,42,0.08)] px-4 py-4 sm:px-5">
                <Search className="h-5 w-5 shrink-0 text-[color:var(--docs-search-placeholder,var(--fd-muted-foreground))]" />
                <Input
                  ref={inputRef}
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder={resolvedPlaceholder}
                  aria-label={resolvedPlaceholder}
                  className="h-auto border-0 bg-transparent px-0 py-0 text-[20px] font-medium tracking-[-0.02em] text-[color:var(--docs-body-copy,var(--fd-foreground))] shadow-none placeholder:text-[color:var(--docs-search-placeholder,var(--fd-muted-foreground))] focus-visible:ring-0"
                />
                <DialogPrimitive.Close asChild>
                  <button
                    type="button"
                    className="inline-flex h-12 shrink-0 items-center rounded-2xl border border-[rgba(15,23,42,0.08)] bg-white px-4 text-[13px] font-semibold text-[color:var(--docs-body-copy,var(--fd-foreground))] shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:bg-[color:var(--docs-search-background,var(--fd-muted))]"
                  >
                    <span aria-hidden="true">Esc</span>
                    <span className="sr-only">{copy.search.close}</span>
                  </button>
                </DialogPrimitive.Close>
              </div>

              <div className="max-h-[min(68vh,40rem)] overflow-y-auto p-3 sm:p-4">
                {!q.trim() ? (
                  <div className="space-y-4 rounded-[24px] border border-[rgba(15,23,42,0.06)] bg-white/80 px-5 py-5">
                    <div>
                      <div className="text-[15px] font-semibold text-fd-foreground">
                        {copy.search.startTyping}
                      </div>
                      <div className="mt-1 text-sm leading-6 text-[color:var(--docs-body-copy-subtle,var(--fd-muted-foreground))]">
                        {copy.sidebar.searchHint}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-[color:var(--docs-body-copy-subtle,var(--fd-muted-foreground))]">
                      <span className="inline-flex items-center gap-2 rounded-full bg-[color:var(--docs-search-background,var(--fd-muted))] px-3 py-1.5">
                        <kbd className="rounded-md border border-[rgba(15,23,42,0.08)] bg-white px-1.5 py-0.5 font-mono text-[11px] font-medium text-fd-foreground">
                          ↑↓
                        </kbd>
                        <span>{copy.search.navigate}</span>
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full bg-[color:var(--docs-search-background,var(--fd-muted))] px-3 py-1.5">
                        <kbd className="rounded-md border border-[rgba(15,23,42,0.08)] bg-white px-1.5 py-0.5 font-mono text-[11px] font-medium text-fd-foreground">
                          Enter
                        </kbd>
                        <span>{copy.search.select}</span>
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full bg-[color:var(--docs-search-background,var(--fd-muted))] px-3 py-1.5">
                        <kbd className="rounded-md border border-[rgba(15,23,42,0.08)] bg-white px-1.5 py-0.5 font-mono text-[11px] font-medium text-fd-foreground">
                          Esc
                        </kbd>
                        <span>{copy.search.close}</span>
                      </span>
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
                  <div className="space-y-3 rounded-[24px] border border-[rgba(15,23,42,0.06)] bg-white/80 px-5 py-5">
                    <div className="text-sm text-[color:var(--docs-body-copy-subtle,var(--fd-muted-foreground))]">
                      {copy.search.loading}
                    </div>
                    <div className="space-y-2">
                      <div className="h-16 rounded-[20px] bg-[linear-gradient(90deg,rgba(15,23,42,0.04),rgba(15,23,42,0.08),rgba(15,23,42,0.04))]" />
                      <div className="h-16 rounded-[20px] bg-[linear-gradient(90deg,rgba(15,23,42,0.03),rgba(15,23,42,0.07),rgba(15,23,42,0.03))]" />
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
                      className={cn(
                        "space-y-2 rounded-[24px] border border-[rgba(15,23,42,0.06)] bg-white/88 p-2",
                        resultsClassName,
                      )}
                    >
                      {results.map((result, index) => {
                        const meta = [
                          result.breadcrumbs?.length
                            ? result.breadcrumbs.join(" / ")
                            : "",
                          result.sectionTitle &&
                          result.sectionTitle !== result.title
                            ? result.sectionTitle
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" · ");
                        const isActive = resolvedActiveIndex === index;
                        const isSectionResult = Boolean(
                          result.sectionTitle &&
                          result.sectionTitle !== result.title,
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
                              "group relative flex items-start gap-3 rounded-[20px] px-3 py-3 transition",
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
                                isActive &&
                                  "bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)]",
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
                                  {renderHighlightedText(
                                    result.title,
                                    highlightTerms,
                                  )}
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
                                  {renderHighlightedText(
                                    bodyText,
                                    highlightTerms,
                                  )}
                                </span>
                              ) : null}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 rounded-[24px] border border-[rgba(15,23,42,0.06)] bg-white/88 px-5 py-5">
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
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}
