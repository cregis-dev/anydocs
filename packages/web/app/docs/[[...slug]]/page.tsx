import { redirect, notFound } from "next/navigation";

import {
  getCliDocsSourceFromEnv,
  getDefaultLanguageStaticParams,
  getDefaultPublishedLanguage,
  isDocsReaderAvailable,
  resolveRequestDocsSource,
} from "@/lib/docs/data";

export async function generateStaticParams() {
  if (!isDocsReaderAvailable()) {
    return [];
  }

  const source = getCliDocsSourceFromEnv();
  if (!source) {
    return [];
  }

  return getDefaultLanguageStaticParams(source.projectId, source.customPath);
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  if (!isDocsReaderAvailable()) {
    return notFound();
  }

  const { slug } = await params;
  const source = await resolveRequestDocsSource();
  const suffix = slug?.length ? `/${slug.join("/")}` : "";
  const defaultLanguage = await getDefaultPublishedLanguage(
    source.projectId,
    source.customPath,
  );
  redirect(`/${defaultLanguage}${suffix}`);
}
