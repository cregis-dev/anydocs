import type { ReactNode } from 'react';

import type { OpenApiNavGroup } from '@anydocs/core';

import { ReferenceNav } from '@/components/docs/openapi/reference-nav';
import type { DocsLang } from '@/lib/docs/types';

/** reference 路由自管的两栏布局：左侧 sticky 接口导航，右侧内容（概览或 operation）。 */
export function ReferenceShell({
  lang,
  nav,
  overviewHref,
  overviewLabel,
  children,
}: {
  lang: DocsLang;
  nav: OpenApiNavGroup[];
  overviewHref: string;
  overviewLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[1340px] px-4 py-6 lg:grid lg:grid-cols-[244px_minmax(0,1fr)] lg:gap-10 lg:px-8">
      <aside className="mb-6 lg:mb-0">
        <div className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-2">
          <ReferenceNav lang={lang} nav={nav} overviewHref={overviewHref} overviewLabel={overviewLabel} />
        </div>
      </aside>
      <main className="min-w-0">{children}</main>
    </div>
  );
}
