import { notFound } from 'next/navigation';

import {
  getPublishedLanguages,
  isDocsReaderAvailable,
  resolveRequestDocsSource,
} from '@/lib/docs/data';

export async function generateStaticParams() {
  if (!isDocsReaderAvailable()) {
    return [];
  }

  const languages = await getPublishedLanguages();
  return languages.map((lang) => ({ lang }));
}

export default async function Page({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  if (!isDocsReaderAvailable()) {
    return notFound();
  }

  const { lang } = await params;
  const source = await resolveRequestDocsSource();
  const languages = await getPublishedLanguages(source.projectId, source.customPath);
  if (!languages.includes(lang as (typeof languages)[number])) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Docs</h1>
      <p className="mt-2 text-sm text-fd-muted-foreground">Select a document from the sidebar.</p>
    </div>
  );
}
