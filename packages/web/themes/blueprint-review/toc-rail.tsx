'use client';

import { List } from 'lucide-react';

import { DocsToc } from '@/components/docs/toc';
import { getDocsUiCopy } from '@/components/docs/docs-ui-copy';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { DocsLang } from '@/lib/docs/types';
import { cn } from '@/lib/utils';
import type { TocItem } from '@/lib/docs/markdown';

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
        'hidden xl:!block xl:sticky xl:top-4 xl:h-[calc(100dvh-2rem)]',
        className,
      )}
      aria-label="Table of contents"
    >
      <div className="flex h-full w-[240px] overflow-hidden rounded-[24px] border border-[color:var(--blueprint-divider)] bg-[color:color-mix(in_srgb,var(--blueprint-panel)_94%,transparent)] shadow-[0_16px_32px_rgba(15,23,42,0.05)] 2xl:w-[272px]">
        <div className="flex h-full w-full flex-col px-4 py-4" data-blueprint-divider>
          <div className="flex items-center justify-between gap-2 border-b pb-3" data-blueprint-divider>
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-fd-muted-foreground">
              {copy.toc.title}
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden pt-3">
            <DocsToc
              toc={toc}
              hideTitle
              className="!block h-full w-full border-0 bg-transparent px-0 py-0"
              contentClassName="max-h-full overflow-y-auto pr-1"
              listClassName="space-y-0.5"
              activeLinkClassName="bg-[color:var(--blueprint-accent-soft)] text-fd-foreground"
              inactiveLinkClassName="text-fd-muted-foreground hover:bg-[color:var(--docs-sidebar-hover,var(--fd-muted))] hover:text-fd-foreground"
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
    <div className={cn('xl:hidden', className)}>
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
          <DialogTitle className="px-5 pt-5 text-sm font-semibold text-fd-foreground">{copy.toc.title}</DialogTitle>
          <DialogDescription className="sr-only">{copy.blueprint.showToc}</DialogDescription>
          <div className="max-h-[70dvh] overflow-y-auto px-3 pb-4 pt-3">
            <DocsToc
              toc={toc}
              hideTitle
              className="!block h-auto w-full border-0 bg-transparent px-0 py-0"
              contentClassName="max-h-none overflow-visible"
              listClassName="space-y-0.5"
              activeLinkClassName="bg-[color:var(--blueprint-accent-soft)] text-fd-foreground"
              inactiveLinkClassName="text-fd-muted-foreground hover:bg-[color:var(--docs-sidebar-hover,var(--fd-muted))] hover:text-fd-foreground"
              disableDefaultDepthStyles
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
