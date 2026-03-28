import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import '../globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Dev Docs',
    template: '%s | Dev Docs',
  },
  description: '面向开发者的产品/组件文档与示例',
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" className="cregis-theme" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}
