import { ANYDOCS_RUNTIME_ENV, DOCS_RUNTIME_MODES } from '@anydocs/core/runtime-contract';

const forceDesktopStaticExport = process.env.ANYDOCS_DESKTOP_STATIC_EXPORT === '1';

const shouldStaticExport =
  forceDesktopStaticExport || process.env[ANYDOCS_RUNTIME_ENV.docsRuntime] === DOCS_RUNTIME_MODES.export;

const nextConfig = {
  reactStrictMode: true,
  // Transpile the workspace editor package from source. Its `exports` resolve
  // to `dist/`, which only exists after `pnpm --filter @anydocs/editor build`
  // — but the CI build step (`pnpm test` → cli tests → spawn `next build`)
  // runs before that build. Listing it here lets Next's webpack consume the
  // source directly. @anydocs/core already has dist/ by this point because
  // editor's typecheck builds core as a pre-step, so it does not need to be
  // transpiled.
  transpilePackages: ['@anydocs/editor'],
  env: {
    NEXT_PUBLIC_ANYDOCS_ASK_URL: process.env.NEXT_PUBLIC_ANYDOCS_ASK_URL ?? '',
  },
  // Studio local APIs require a normal dev server. Static export is only needed for docs export/build flows.
  output: shouldStaticExport ? 'export' : undefined,
  distDir: process.env.ANYDOCS_NEXT_DIST_DIR || '.next',
  typescript: {
    ignoreBuildErrors: true,
  },
  // Disable image optimization for static export
  images: {
    unoptimized: true
  },
  // Only force trailing slashes for static export. In dev, this breaks local API routes by redirecting
  // `/api/local/*` to slash-suffixed URLs that do not resolve.
  trailingSlash: shouldStaticExport,
};

export default nextConfig;
