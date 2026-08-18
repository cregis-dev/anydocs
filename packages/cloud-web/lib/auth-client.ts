'use client';

import { createAuthClient } from 'better-auth/react';

// Browser-side Better Auth client. baseURL defaults to the current origin when the public
// env var is unset — the auth handler is mounted same-origin at /api/auth, so this works in
// local dev without extra config. Set NEXT_PUBLIC_BETTER_AUTH_URL when the API lives elsewhere.
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
});

export const { signIn, signUp, signOut, useSession } = authClient;
