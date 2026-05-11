'use client';

import { ApiReferenceReact } from '@scalar/api-reference-react';
import '@scalar/api-reference-react/style.css';

function normalizeScalarContent(value: unknown): Record<string, unknown> | string | null {
  if (typeof value === 'string') {
    return value;
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
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
  return (
    <div className="anydocs-scalar-shell min-w-0 rounded-[18px] border border-[color:var(--atlas-content-border,var(--fd-border))] bg-white shadow-[0_1px_0_var(--atlas-content-shadow,rgba(0,0,0,0.04))]">
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
            hideTestRequestButton: !showTryIt,
            showSidebar: true,
            theme: 'default',
          }}
        />
      </div>
    </div>
  );
}
