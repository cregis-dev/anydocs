import type { DocsLang } from './types.ts';

export async function resolveReaderLanguageHref(
  pathname: string,
  currentLang: DocsLang,
  nextLang: DocsLang,
  searchIndexHref?: string,
  request: typeof fetch = fetch,
): Promise<string> {
  const home = `/${nextLang}/`;
  const prefix = `/${currentLang}/`;
  if (!pathname.startsWith(prefix)) return home;
  const suffix = pathname.slice(prefix.length);
  if (!suffix) return home;

  // Languages may be maintained independently and have different slugs.
  // Load only the target index, and only when a reader changes language.
  const index = searchIndexHref?.startsWith('/api/docs/search-index?')
    ? `/api/docs/search-index?lang=${nextLang}`
    : `/search-index.${nextLang}.json`;
  try {
    const slug = decodeURIComponent(suffix.replace(/\/$/, ''));
    const response = await request(index);
    if (!response.ok) return home;
    const data = await response.json() as { docs?: Array<{ pageSlug?: string; slug?: string } | null> };
    if (Array.isArray(data?.docs) && data.docs.some((doc) => (doc?.pageSlug ?? doc?.slug) === slug)) {
      return `${home}${suffix}`;
    }
  } catch {
    // An unavailable or stale index must not send the reader to a missing page.
  }
  return home;
}
