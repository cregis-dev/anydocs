import type { MetadataRoute } from "next";

import { getPublishedApiSources } from "@/lib/docs/api-sources";
import {
  getCliDocsSourceFromEnv,
  getPublishedLanguages,
  getPublishedSite,
  getPublishedSiteUrl,
  isDocsReaderAvailable,
} from "@/lib/docs/data";
import { buildPublishedAbsoluteUrl } from "@/lib/docs/seo";

export const dynamic = "force-static";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const source = getCliDocsSourceFromEnv();
  if (!isDocsReaderAvailable() || !source) {
    return [];
  }

  const siteUrl = await getPublishedSiteUrl(
    source.projectId,
    source.customPath,
  );
  if (!siteUrl) {
    return [];
  }

  const languages = await getPublishedLanguages(
    source.projectId,
    source.customPath,
  );
  const entries: MetadataRoute.Sitemap = [];

  for (const language of languages) {
    const landingUrl = buildPublishedAbsoluteUrl(siteUrl, language);
    if (landingUrl) {
      entries.push({ url: landingUrl });
    }

    const site = await getPublishedSite(
      language,
      source.projectId,
      source.customPath,
    );
    for (const page of site.pages) {
      const pageUrl = buildPublishedAbsoluteUrl(
        siteUrl,
        `${language}/${page.slug}`,
      );
      if (!pageUrl) {
        continue;
      }

      entries.push({
        url: pageUrl,
        ...(page.updatedAt ? { lastModified: page.updatedAt } : {}),
      });
    }

    const apiSources = await getPublishedApiSources(
      language,
      source.projectId,
      source.customPath,
    );
    if (apiSources.length === 0) {
      continue;
    }

    const referenceIndexUrl = buildPublishedAbsoluteUrl(
      siteUrl,
      `${language}/reference`,
    );
    if (referenceIndexUrl) {
      entries.push({ url: referenceIndexUrl });
    }

    for (const apiSource of apiSources) {
      const apiSourceUrl = buildPublishedAbsoluteUrl(
        siteUrl,
        `${language}/reference/${apiSource.id}`,
      );
      if (!apiSourceUrl) {
        continue;
      }

      entries.push({ url: apiSourceUrl });
    }
  }

  return entries;
}
