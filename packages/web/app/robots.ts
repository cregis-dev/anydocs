import type { MetadataRoute } from "next";

import {
  getCliDocsRuntimeMode,
  getCliDocsSourceFromEnv,
  getPublishedSiteUrl,
  isDocsReaderAvailable,
} from "@/lib/docs/data";
import { buildPublishedAbsoluteUrl } from "@/lib/docs/seo";

export const dynamic = "force-static";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const source = getCliDocsSourceFromEnv();
  if (
    !isDocsReaderAvailable() ||
    getCliDocsRuntimeMode() === "preview" ||
    !source
  ) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  const siteUrl = await getPublishedSiteUrl(
    source.projectId,
    source.customPath,
  );
  const sitemap = buildPublishedAbsoluteUrl(siteUrl, "sitemap.xml");

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    ...(sitemap ? { sitemap } : {}),
  };
}
