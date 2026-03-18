import { notFound, redirect } from 'next/navigation';

import { LocalStudioApp } from '@/components/studio/local-studio-app';
import { getDefaultPublishedLanguage, isDesktopRuntimeEnabled, isExplicitCliDocsRuntimeEnabled } from '@/lib/docs/data';

export default async function Page() {
  if (isExplicitCliDocsRuntimeEnabled()) {
    const defaultLanguage = await getDefaultPublishedLanguage();
    redirect(`/${defaultLanguage}`);
  }

  if (process.env.NODE_ENV === 'production' && !isDesktopRuntimeEnabled()) {
    notFound();
  }
  return <LocalStudioApp />;
}
