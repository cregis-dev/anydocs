export default function Home() {
  // Baseline landing. The four-region shell + sign-in land in Stories C1.1–C1.4.
  return (
    <main style={{ padding: 'var(--t-32)' }}>
      <h1 style={{ font: 'var(--font-ui)', fontSize: 'var(--t-28)', color: 'var(--n-900)' }}>
        Anydocs Studio — Cloud Team Edition
      </h1>
      <p style={{ color: 'var(--n-600)', fontSize: 'var(--t-15)' }}>
        Baseline scaffold (Story C1.0). App shell, auth, and editor land in subsequent C1/C2 stories.
      </p>
    </main>
  );
}
