const shouldStaticExport = process.env.ANYDOCS_DOCS_RUNTIME === 'export';

const nextConfig = {
  reactStrictMode: true,
  // Studio local APIs require a normal dev server. Static export is only needed for docs export/build flows.
  output: shouldStaticExport ? 'export' : undefined,
  distDir: process.env.ANYDOCS_NEXT_DIST_DIR || '.next',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
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
