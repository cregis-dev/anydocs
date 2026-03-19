'use client';

import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

type NavigationItemDialogKind = 'page' | 'group' | 'link';

export type NavigationItemDialogValues = {
  title: string;
  slug: string;
  href: string;
};

type NavigationItemDialogConfig = {
  kind: NavigationItemDialogKind;
  title: string;
  description: string;
  submitLabel: string;
  initialValues?: Partial<NavigationItemDialogValues>;
};

export function NavigationItemDialog({
  open,
  config,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  config: NavigationItemDialogConfig | null;
  onOpenChange: (next: boolean) => void;
  onSubmit: (values: NavigationItemDialogValues) => Promise<void> | void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl border-fd-border bg-fd-card p-0">
        {config ? (
          <NavigationItemDialogForm
            key={`${String(open)}:${config.kind}:${config.title}:${config.initialValues?.title ?? ''}:${config.initialValues?.slug ?? ''}:${config.initialValues?.href ?? ''}`}
            config={config}
            onOpenChange={onOpenChange}
            onSubmit={onSubmit}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function NavigationItemDialogForm({
  config,
  onOpenChange,
  onSubmit,
}: {
  config: NavigationItemDialogConfig;
  onOpenChange: (next: boolean) => void;
  onSubmit: (values: NavigationItemDialogValues) => Promise<void> | void;
}) {
  const [title, setTitle] = useState(config.initialValues?.title ?? '');
  const [slug, setSlug] = useState(config.initialValues?.slug ?? '');
  const [href, setHref] = useState(config.initialValues?.href ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = useMemo(() => {
    if (config.kind === 'page') {
      return slug.trim().length > 0 && title.trim().length > 0;
    }

    if (config.kind === 'group') {
      return title.trim().length > 0;
    }

    return title.trim().length > 0 && href.trim().length > 0;
  }, [config.kind, href, slug, title]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValid || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        title: title.trim(),
        slug: slug.trim(),
        href: href.trim(),
      });
      onOpenChange(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '提交失败');
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-0">
      <DialogHeader className="border-b border-fd-border px-6 py-5 text-left">
        <DialogTitle className="text-base">{config.title}</DialogTitle>
        <DialogDescription>{config.description}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 px-6 py-5">
        {config.kind === 'page' ? (
          <>
            <div className="grid gap-2">
              <div className="text-sm font-medium text-fd-foreground">Page title</div>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Untitled" autoFocus />
            </div>
            <div className="grid gap-2">
              <div className="text-sm font-medium text-fd-foreground">Slug</div>
              <Input
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                placeholder="getting-started/new-page"
              />
              <div className="text-xs text-fd-muted-foreground">Use the published URL path, for example `guides/intro`.</div>
            </div>
          </>
        ) : null}

        {config.kind === 'group' ? (
          <div className="grid gap-2">
            <div className="text-sm font-medium text-fd-foreground">Group title</div>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Group" autoFocus />
          </div>
        ) : null}

        {config.kind === 'link' ? (
          <>
            <div className="grid gap-2">
              <div className="text-sm font-medium text-fd-foreground">Link title</div>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Link" autoFocus />
            </div>
            <div className="grid gap-2">
              <div className="text-sm font-medium text-fd-foreground">Link URL</div>
              <Input value={href} onChange={(event) => setHref(event.target.value)} placeholder="https://" />
            </div>
          </>
        ) : null}

        {error ? <div className="text-sm text-fd-error">{error}</div> : null}
      </div>

      <DialogFooter className="border-t border-fd-border px-6 py-4">
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={!isValid || submitting}>
          {config.submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
