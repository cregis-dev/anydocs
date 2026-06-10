'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

function isReferencePath(pathname: string | null): boolean {
  return !!pathname && /^\/[^/]+\/reference(?:\/|$)/.test(pathname);
}

/**
 * 读者两栏网格的局部 client 边界：普通文档路由保持「文档侧栏 + 内容」两栏；
 * reference 路由让出文档侧栏、压成单列，由 page 层的 ReferenceShell 自管接口导航两栏。
 *
 * 用 React 条件渲染（而非 CSS）控制，彻底绕开 Tailwind v4 `@layer` + `!important`
 * 与 grid 轨道的优先级坑。主题 layout 其余部分仍是 Server Component。
 */
export function DocsReaderColumns({
  gridClassName,
  sidebarColumn,
  children,
}: {
  gridClassName: string;
  sidebarColumn: ReactNode;
  children: ReactNode;
}) {
  const isReference = isReferencePath(usePathname());

  if (isReference) {
    return <div className="min-w-0">{children}</div>;
  }

  return (
    <div className={cn(gridClassName)}>
      {sidebarColumn}
      {children}
    </div>
  );
}
