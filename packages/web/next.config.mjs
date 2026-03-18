const shouldStaticExport =
  process.env.ANYDOCS_DOCS_RUNTIME === 'export' || process.env.NODE_ENV === 'production';

const nextConfig = {
  reactStrictMode: true,
  // Studio local APIs require a normal dev server. Static export is only needed for docs export/build flows.
  output: shouldStaticExport ? 'export' : undefined,
  distDir: process.env.ANYDOCS_NEXT_DIST_DIR || '.next',
  // Disable image optimization for static export
  images: {
    unoptimized: true
  },
  // Ensure trailing slashes for static export
  trailingSlash: true,
};

export default nextConfig;
