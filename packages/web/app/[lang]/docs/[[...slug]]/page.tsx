import { redirect, notFound } from 'next/navigation';

import {
  getPublishedDocStaticParams,
  isDocsReaderAvailable,
} from '@/lib/docs/data';

export default async function Page({
  params,
}: {
  params: Promise<{ lang: string; slug?: string[] }>;
}) {
  if (!isDocsReaderAvailable()) {
    return notFound();
  }

  const { lang, slug } = await params;
  const suffix = slug?.length ? `/${slug.join('/')}` : '';
  redirect(`/${lang}${suffix}`);
}

export async function generateStaticParams() {
  if (!isDocsReaderAvailable()) {
    return [];
  }

  return getPublishedDocStaticParams();
}
