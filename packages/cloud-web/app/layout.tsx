import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Anydocs Studio — Cloud',
  description: 'Cloud, multi-tenant, AI-First documentation workspace.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="ax">{children}</body>
    </html>
  );
}
