import { notFound } from 'next/navigation';

import { StudioEntry } from '@/components/studio/studio-entry';
import { readStudioBootContext } from '@/components/studio/studio-boot';
import { isExplicitCliDocsRuntimeEnabled } from '@/lib/docs/data';

export default function StudioPage() {
  const bootContext = readStudioBootContext();

  if (isExplicitCliDocsRuntimeEnabled()) {
    notFound();
  }

  if (!bootContext) {
    notFound();
  }

  return <StudioEntry bootContext={bootContext} />;
}
