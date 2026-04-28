import { ANYDOCS_RUNTIME_ENV, DOCS_RUNTIME_MODES } from '@anydocs/core/runtime-contract';

const shouldStaticExport = process.env[ANYDOCS_RUNTIME_ENV.docsRuntime] === DOCS_RUNTIME_MODES.export;

const nextConfig = {
  reactStrictMode: true,
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
