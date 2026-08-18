import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';
import { resolveAuthRedirect } from './lib/auth-guard';

// Protects the (app) route group. Uses Better Auth's optimistic session-cookie presence check
// (no DB round-trip in the edge middleware); server-side getSession() on the protected page is
// the authoritative expiry/invalidity check. Redirect happens before any tenant data is loaded.
export function middleware(request: NextRequest): NextResponse {
  const hasSessionCookie = getSessionCookie(request) != null;
  const redirectTo = resolveAuthRedirect(request.nextUrl.pathname, hasSessionCookie);

  if (redirectTo) {
    const url = request.nextUrl.clone();
    url.pathname = redirectTo;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Scope middleware to protected routes only. /sign-in, /api/auth/*, the landing page, and
// static assets are excluded by omission. Extend as protected areas are added (C1.2+).
export const config = {
  matcher: ['/home/:path*'],
};
