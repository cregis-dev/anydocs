export function createLocalApiUrl(pathname: string, params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  // Bust browser-cached 308 redirects from older local API URL shapes.
  search.set('__studio_api', '2');

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      search.set(key, value);
    }
  }

  const query = search.toString();
  return `/api/local/${pathname}${query ? `?${query}` : ''}`;
}
