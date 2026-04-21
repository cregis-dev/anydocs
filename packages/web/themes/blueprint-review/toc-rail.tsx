"use client";

import { List } from "lucide-react";

import { DocsToc } from "@/components/docs/toc";
import { getDocsUiCopy } from "@/components/docs/docs-ui-copy";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { DocsLang } from "@/lib/docs/types";
import { cn } from "@/lib/utils";
import type { TocItem } from "@/lib/docs/markdown";

const blueprintTocListClassName =
  "relative space-y-0.5 pl-3 before:absolute before:bottom-2 before:left-0 before:top-2 before:w-px before:bg-[color:color-mix(in_srgb,var(--blueprint-divider)_92%,white)] [&_[data-depth='2']]:mt-2 [&_[data-depth='2']]:py-1.5 [&_[data-depth='2']]:pl-3 [&_[data-depth='2']]:text-[13px] [&_[data-depth='2']]:font-medium [&_[data-depth='2']]:leading-6 [&_[data-depth='2']]:text-[color:color-mix(in_srgb,var(--fd-foreground)_92%,white)] [&_[data-depth='3']]:pl-5 [&_[data-depth='3']]:text-[12px] [&_[data-depth='3']]:leading-5 [&_[data-depth='4']]:pl-6 [&_[data-depth='4']]:text-[11px] [&_[data-depth='4']]:leading-5";

const blueprintTocActiveLinkClassName =
  "relative rounded-r-[14px] border-l-0 bg-[color:color-mix(in_srgb,var(--blueprint-accent-soft)_42%,white)] py-1.5 pl-3 pr-2 font-semibold tracking-[-0.01em] break-words text-fd-foreground before:absolute before:bottom-2 before:-left-3 before:top-2 before:w-[2px] before:rounded-full before:bg-[color:var(--blueprint-accent)]";

const blueprintTocInactiveLinkClassName =
  "rounded-r-[14px] border-l-0 bg-transparent py-1.5 pl-3 pr-2 font-normal tracking-[-0.01em] break-words text-[color:color-mix(in_srgb,var(--fd-muted-foreground)_88%,white)] hover:bg-[color:color-mix(in_srgb,var(--blueprint-accent-soft)_38%,white)] hover:text-fd-foreground";

export function BlueprintTocRail({
  toc,
  lang,
  className,
}: {
  toc: TocItem[];
  lang: DocsLang;
  className?: string;
}) {
  const copy = getDocsUiCopy(lang);

  if (!toc.length) {
    return null;
  }

  return (
    <aside
      className={cn(
        "hidden xl:!block xl:sticky xl:top-8 xl:self-start",
        className,
      )}
      aria-label="Table of contents"
    >
      <div className="w-[220px] 2xl:w-[236px]">
        <div className="px-2 py-3">
          <div
            className="flex items-center justify-between gap-2 border-b pb-3"
            data-blueprint-divider
          >
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-fd-muted-foreground">
              {copy.toc.title}
            </span>
          </div>
          <div className="pt-3">
            <DocsToc
              toc={toc}
              hideTitle
              className="!block h-auto w-full border-0 bg-transparent px-0 py-0"
              contentClassName="max-h-[calc(100dvh-10rem)] overflow-y-auto pr-1"
              listClassName={blueprintTocListClassName}
              activeLinkClassName={blueprintTocActiveLinkClassName}
              inactiveLinkClassName={blueprintTocInactiveLinkClassName}
              disableDefaultDepthStyles
            />
          </div>
        </div>
      </div>
    </aside>
  );
}

export function BlueprintMobileTocButton({
  toc,
  lang,
  className,
}: {
  toc: TocItem[];
  lang: DocsLang;
  className?: string;
}) {
  const copy = getDocsUiCopy(lang);

  if (!toc.length) {
    return null;
  }

  return (
    <div className={cn("xl:hidden", className)}>
      <Dialog>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="secondary"
            className="h-9 rounded-lg border-[color:var(--blueprint-divider)] bg-white px-3 text-[13px] font-medium text-fd-foreground shadow-none"
          >
            <List className="mr-2 h-4 w-4" />
            {copy.toc.title}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-[22rem] rounded-[24px] border-[color:var(--blueprint-divider)] bg-fd-background p-0">
          <DialogTitle className="px-5 pt-5 text-sm font-semibold text-fd-foreground">
            {copy.toc.title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {copy.blueprint.showToc}
          </DialogDescription>
          <div className="max-h-[70dvh] overflow-y-auto px-3 pb-4 pt-3">
            <DocsToc
              toc={toc}
              hideTitle
              className="!block h-auto w-full border-0 bg-transparent px-0 py-0"
              contentClassName="max-h-none overflow-visible"
              listClassName={blueprintTocListClassName}
              activeLinkClassName={blueprintTocActiveLinkClassName}
              inactiveLinkClassName={blueprintTocInactiveLinkClassName}
              disableDefaultDepthStyles
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
