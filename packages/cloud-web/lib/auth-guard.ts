// Pure, runtime-agnostic auth-guard logic shared by middleware.ts.
// Kept free of next/server + better-auth imports so it is unit-testable without the Next
// edge runtime or a DB — the middleware wiring layer supplies the cookie-presence signal.

export const SIGN_IN_PATH = '/sign-in';

// Route prefixes that require an authenticated session. The (app) route group renders here;
// extend this list as new protected areas land (workspace/project routes in C1.2+).
export const PROTECTED_PREFIXES = ['/home'] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Decide whether a request to `pathname` must be redirected to sign-in.
 *
 * `hasSessionCookie` is Better Auth's optimistic cookie-presence check (no DB round-trip).
 * A missing cookie on a protected path is a hard redirect here; expired/invalid-but-present
 * sessions are caught server-side by the protected page's getSession() before any tenant data
 * is fetched or rendered (defense in depth — no data leak on the redirect path).
 *
 * @returns the redirect target path, or null to allow the request through.
 */
export function resolveAuthRedirect(
  pathname: string,
  hasSessionCookie: boolean,
): string | null {
  if (isProtectedPath(pathname) && !hasSessionCookie) return SIGN_IN_PATH;
  return null;
}
