import { notFound, redirect } from 'next/navigation';

import { StudioEntry } from '@/components/studio/studio-entry';
import { readStudioBootContext } from '@/components/studio/studio-boot';
import { getDefaultPublishedLanguage, isExplicitCliDocsRuntimeEnabled } from '@/lib/docs/data';

export default async function Page() {
  const bootContext = readStudioBootContext();

  if (isExplicitCliDocsRuntimeEnabled()) {
    const defaultLanguage = await getDefaultPublishedLanguage();
    redirect(`/${defaultLanguage}`);
  }

  if (!bootContext) {
    notFound();
  }

  return <StudioEntry bootContext={bootContext} />;
}
