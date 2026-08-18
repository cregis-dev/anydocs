import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuth } from '@anydocs/cloud-core/auth';
import { SignOutButton } from './sign-out-button';

// Session-gated and request-scoped: never statically prerendered (no DB access at build time).
export const dynamic = 'force-dynamic';

// Minimal post-sign-in landing that proves the authenticated state (real Workspace Home is C8.1).
// Server-side getSession() is the authoritative check: an expired/invalid or signed-out session
// returns null and we redirect BEFORE rendering any user/workspace data (AC2 no-leak, AC3).
export default async function HomePage() {
  const session = await getAuth().api.getSession({ headers: await headers() });

  if (!session) {
    redirect('/sign-in');
  }

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--t-16)',
        padding: 'var(--t-32)',
        background: 'var(--n-0)',
      }}
    >
      <h1
        style={{
          margin: 0,
          fontFamily: 'var(--font-ui)',
          fontSize: 'var(--t-28)',
          color: 'var(--n-900)',
        }}
      >
        Signed in
      </h1>
      <p style={{ margin: 0, fontSize: 'var(--t-15)', color: 'var(--n-600)' }}>
        You have an authenticated session. Stable user id:{' '}
        <code style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-13)' }}>
          {session.user.id}
        </code>
      </p>
      <div>
        <SignOutButton />
      </div>
    </main>
  );
}
