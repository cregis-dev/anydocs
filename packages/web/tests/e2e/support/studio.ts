const explicitStudioUrl = process.env.STUDIO_URL;
const normalizedStudioBaseUrl = explicitStudioUrl
  ? explicitStudioUrl.replace(/\/studio\/?$/, '').replace(/\/$/, '').replace('://localhost', '://127.0.0.1')
  : 'http://127.0.0.1:3000';

export const studioBaseUrl = normalizedStudioBaseUrl;
export const studioUrl = `${studioBaseUrl}/studio`;

export function buildLocalApiUrl(pathname: string, params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  query.set('__studio_api', '2');

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      query.set(key, value);
    }
  }

  return `${studioBaseUrl}/api/local/${pathname}?${query.toString()}`;
}
