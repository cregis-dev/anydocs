'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth-client';

// Invalidates the session server-side (Better Auth deletes the session row + clears the cookie),
// then sends the user back to sign-in. AC3: a later hit on a protected route redirects.
export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          await signOut();
          router.push('/sign-in');
          router.refresh();
        } finally {
          // Always release the pending state so a failed sign-out doesn't wedge the button.
          setPending(false);
        }
      }}
      style={{
        padding: 'var(--t-11) var(--t-16)',
        fontFamily: 'var(--font-ui)',
        fontSize: 'var(--t-14)',
        color: 'var(--n-800)',
        background: 'var(--n-50)',
        border: '1px solid var(--n-300)',
        borderRadius: 'var(--r-8)',
        cursor: pending ? 'progress' : 'pointer',
        opacity: pending ? 0.7 : 1,
      }}
    >
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
