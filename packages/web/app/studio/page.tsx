import { notFound } from 'next/navigation';

import { LocalStudioApp } from '@/components/studio/local-studio-app';
import { isDesktopRuntimeEnabled, isExplicitCliDocsRuntimeEnabled } from '@/lib/docs/data';

export default function StudioPage() {
  if ((process.env.NODE_ENV === 'production' && !isDesktopRuntimeEnabled()) || isExplicitCliDocsRuntimeEnabled()) {
    notFound();
  }

  return <LocalStudioApp />;
}
