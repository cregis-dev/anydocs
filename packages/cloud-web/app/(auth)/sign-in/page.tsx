'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, signUp } from '@/lib/auth-client';

// Sign-in / sign-up for the Cloud Team Edition (Better Auth email/password baseline).
// AC4: OAuth is a declared extension point — adding a social provider is Better Auth config
// (server socialProviders + a signIn.social call) and needs no change to this flow.
// All design values read from tokens.css (CNFR4) — nothing hard-coded.

type Mode = 'sign-in' | 'sign-up';

export default function SignInPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result =
        mode === 'sign-in'
          ? await signIn.email({ email, password })
          : await signUp.email({ email, password, name: name || email });

      if (result.error) {
        // Self-explaining message only — never surface a raw stack (design brief §9.5).
        setError(result.error.message ?? 'Something went wrong. Please try again.');
        return;
      }

      // Relies on Better Auth autoSignIn (default) establishing a session on sign-up. If a future
      // config requires email verification before sign-in, /home's server-side getSession() will
      // bounce back to /sign-in rather than render — no unauthenticated state leaks either way.
      router.push('/home');
      router.refresh();
    } catch {
      setError('Unable to reach the server. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 'var(--t-24)',
        background: 'var(--n-0)',
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{
          width: '100%',
          maxWidth: '360px',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--t-16)',
          padding: 'var(--t-32)',
          background: 'var(--n-50)',
          border: '1px solid var(--n-200)',
          borderRadius: 'var(--r-12)',
          boxShadow: 'var(--sh-2)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--t-11)' }}>
          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--font-ui)',
              fontSize: 'var(--t-24)',
              color: 'var(--n-900)',
            }}
          >
            {mode === 'sign-in' ? 'Sign in' : 'Create your account'}
          </h1>
          <p style={{ margin: 0, fontSize: 'var(--t-14)', color: 'var(--n-500)' }}>
            Anydocs Studio — Cloud Team Edition
          </p>
        </div>

        {mode === 'sign-up' && (
          <label style={fieldLabel}>
            Name
            <input
              type="text"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              style={fieldInput}
            />
          </label>
        )}

        <label style={fieldLabel}>
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            style={fieldInput}
          />
        </label>

        <label style={fieldLabel}>
          Password
          <input
            type="password"
            required
            // Enforce the min length on sign-up only — never block an existing account from even
            // attempting sign-in (server returns a proper auth error if credentials are wrong).
            minLength={mode === 'sign-up' ? 8 : undefined}
            autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            style={fieldInput}
          />
        </label>

        {error && (
          <p
            role="alert"
            style={{
              margin: 0,
              fontSize: 'var(--t-13)',
              color: 'var(--bad-700)',
              background: 'var(--bad-50)',
              border: '1px solid var(--bad-500)',
              borderRadius: 'var(--r-6)',
              padding: 'var(--t-11)',
            }}
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          style={{
            marginTop: 'var(--t-11)',
            padding: 'var(--t-12) var(--t-16)',
            fontFamily: 'var(--font-ui)',
            fontSize: 'var(--t-14)',
            color: 'var(--n-0)',
            background: 'var(--brand-600)',
            border: 'none',
            borderRadius: 'var(--r-8)',
            cursor: pending ? 'progress' : 'pointer',
            opacity: pending ? 0.7 : 1,
            transition: 'opacity 120ms var(--ease)',
          }}
        >
          {pending
            ? 'Working…'
            : mode === 'sign-in'
              ? 'Sign in'
              : 'Create account'}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode((current) => (current === 'sign-in' ? 'sign-up' : 'sign-in'));
            setError(null);
          }}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            fontSize: 'var(--t-13)',
            color: 'var(--brand-700)',
            cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          {mode === 'sign-in'
            ? "Don't have an account? Create one"
            : 'Already have an account? Sign in'}
        </button>
      </form>
    </main>
  );
}

const fieldLabel: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--t-11)',
  fontSize: 'var(--t-13)',
  color: 'var(--n-700)',
};

const fieldInput: React.CSSProperties = {
  padding: 'var(--t-11) var(--t-12)',
  fontFamily: 'var(--font-ui)',
  fontSize: 'var(--t-14)',
  color: 'var(--n-900)',
  background: 'var(--n-0)',
  border: '1px solid var(--n-300)',
  borderRadius: 'var(--r-6)',
  outline: 'none',
};
