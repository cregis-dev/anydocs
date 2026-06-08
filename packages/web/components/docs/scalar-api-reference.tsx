'use client';

import { useEffect, useRef } from 'react';
import { ApiReferenceReact } from '@scalar/api-reference-react';
import '@scalar/api-reference-react/style.css';

const ACTIVE_SIDEBAR_CLASSES = ['cursor-auto', 'bg-sidebar-b-active', 'text-sidebar-c-active', 'font-sidebar-active'];
const INACTIVE_SIDEBAR_CLASSES = [
  'font-sidebar',
  'text-sidebar-c-2',
  'hover:bg-sidebar-b-hover',
  'hover:text-sidebar-c-hover',
];

function normalizeScalarContent(value: unknown): Record<string, unknown> | string | null {
  if (typeof value === 'string') {
    return value;
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
}

function getScalarSectionLabel(section: HTMLElement) {
  return section.querySelector('.section-header-label');
}

function getOperationSections(root: HTMLElement) {
  const sections = Array.from(root.querySelectorAll<HTMLElement>('section.section[id^="api-"]'));
  const operationSections = sections.filter((section) => getScalarSectionLabel(section)?.tagName === 'H3');

  return operationSections.length > 0 ? operationSections : sections;
}

function getViewportTopOffset(root: HTMLElement) {
  const styles = window.getComputedStyle(root);
  const rawOffset =
    Number.parseFloat(styles.getPropertyValue('--refs-viewport-offset')) ||
    Number.parseFloat(styles.getPropertyValue('--scalar-custom-header-height')) ||
    0;

  return Math.min(Math.max(rawOffset + 16, 16), window.innerHeight * 0.35);
}

function getVisibleSectionId(root: HTMLElement) {
  const top = getViewportTopOffset(root);
  const bottom = window.innerHeight - 16;
  const readingLine = top + (bottom - top) * 0.35;
  let best: { id: string; visibleHeight: number } | null = null;

  for (const section of getOperationSections(root)) {
    const rect = section.getBoundingClientRect();
    const visibleHeight = Math.max(0, Math.min(rect.bottom, bottom) - Math.max(rect.top, top));

    if (visibleHeight <= 0) {
      continue;
    }

    if (rect.top <= readingLine && rect.bottom > readingLine) {
      return section.id;
    }

    if (!best || visibleHeight > best.visibleHeight) {
      best = { id: section.id, visibleHeight };
    }
  }

  return best?.id ?? null;
}

function setSidebarItemState(item: HTMLElement, isActive: boolean) {
  const control = item.querySelector<HTMLElement>('button, a');

  if (!control) {
    return;
  }

  const selected = control.getAttribute('aria-selected') === 'true';
  const hasActiveClass = control.classList.contains('bg-sidebar-b-active');

  if (isActive) {
    if (!selected) {
      control.setAttribute('aria-selected', 'true');
    }

    control.classList.add(...ACTIVE_SIDEBAR_CLASSES);
    control.classList.remove('font-sidebar', 'text-sidebar-c-2');
    return;
  }

  if (!selected && !hasActiveClass) {
    return;
  }

  control.setAttribute('aria-selected', 'false');
  control.classList.remove(...ACTIVE_SIDEBAR_CLASSES);
  control.classList.add(...INACTIVE_SIDEBAR_CLASSES);
}

function syncScalarSidebarActiveState(root: HTMLElement) {
  const activeId = getVisibleSectionId(root);

  if (!activeId) {
    return;
  }

  for (const item of root.querySelectorAll<HTMLElement>('[data-sidebar-id]')) {
    setSidebarItemState(item, item.dataset.sidebarId === activeId);
  }
}

export function ScalarApiReference({
  specContent,
  showTryIt,
  title,
  description,
}: {
  specContent: unknown;
  showTryIt: boolean;
  title?: string;
  description?: string;
  sourceId?: string;
}) {
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const shell = shellRef.current;

    if (!shell) {
      return;
    }

    let frame = 0;
    let timeout: number | undefined;

    const sync = () => {
      syncScalarSidebarActiveState(shell);
    };

    const scheduleSync = () => {
      window.cancelAnimationFrame(frame);

      if (timeout !== undefined) {
        window.clearTimeout(timeout);
      }

      frame = window.requestAnimationFrame(sync);
      timeout = window.setTimeout(sync, 120);
    };

    const observer = new MutationObserver(scheduleSync);

    window.addEventListener('scroll', scheduleSync, { passive: true });
    window.addEventListener('resize', scheduleSync);
    observer.observe(shell, { childList: true, subtree: true });
    scheduleSync();

    return () => {
      window.cancelAnimationFrame(frame);

      if (timeout !== undefined) {
        window.clearTimeout(timeout);
      }

      window.removeEventListener('scroll', scheduleSync);
      window.removeEventListener('resize', scheduleSync);
      observer.disconnect();
    };
  }, [specContent]);

  return (
    <div
      ref={shellRef}
      className="anydocs-scalar-shell min-w-0 rounded-[18px] border border-[color:var(--atlas-content-border,var(--fd-border))] bg-white shadow-[0_1px_0_var(--atlas-content-shadow,rgba(0,0,0,0.04))]"
    >
      <div className="border-b border-[color:var(--atlas-content-border,var(--fd-border))] bg-[linear-gradient(180deg,#ffffff_0%,#ffffff_35%,#f8faf8_100%)]">
        <div className="flex flex-col gap-4 px-6 py-6 sm:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--docs-body-copy-subtle,var(--fd-muted-foreground))]">
                API Reference
              </p>
              <div className="space-y-2">
                <h1 className="text-[32px] font-semibold leading-[1.05] tracking-[-0.035em] text-fd-foreground sm:text-[36px]">
                  {title ?? 'OpenAPI Reference'}
                </h1>
                <p className="max-w-[720px] text-[14px] leading-6 text-[color:var(--docs-body-copy,var(--fd-muted-foreground))]">
                  {description ?? 'Interactive reference rendered with Scalar and aligned to the active docs theme.'}
                </p>
              </div>
            </div>

            {/* Source IDs are internal and intentionally hidden. */}
          </div>
        </div>
      </div>

      <div className="anydocs-scalar-frame min-w-0">
        <ApiReferenceReact
          configuration={{
            content: normalizeScalarContent(specContent),
            layout: 'modern',
            operationTitleSource: 'summary',
            orderSchemaPropertiesBy: 'preserve',
            orderRequiredPropertiesFirst: false,
            hideTestRequestButton: !showTryIt,
            hideClientButton: true,
            hiddenClients: true,
            hideDarkModeToggle: true,
            showSidebar: true,
            theme: 'default',
          }}
        />
      </div>
    </div>
  );
}
