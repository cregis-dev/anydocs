export type PageSeoMetadata = {
  title?: string;
  description?: string;
  keywords?: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function normalizeKeywords(value: unknown): string[] | undefined {
  const rawKeywords = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  const keywords = Array.from(
    new Set(
      rawKeywords
        .map((keyword) =>
          typeof keyword === 'string' ? keyword.trim() : '',
        )
        .filter((keyword) => keyword.length > 0),
    ),
  );
  return keywords.length > 0 ? keywords : undefined;
}

export function readPageSeoMetadata(metadata: unknown): PageSeoMetadata {
  const seo = isRecord(metadata) && isRecord(metadata.seo)
    ? metadata.seo
    : metadata;

  if (!isRecord(seo)) {
    return {};
  }

  const title = readNonEmptyString(seo.title);
  const description = readNonEmptyString(seo.description);
  const keywords = normalizeKeywords(seo.keywords);

  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(keywords ? { keywords } : {}),
  };
}
