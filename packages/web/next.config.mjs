import { ANYDOCS_RUNTIME_ENV, DOCS_RUNTIME_MODES } from '@anydocs/core/runtime-contract';

const forceDesktopStaticExport = process.env.ANYDOCS_DESKTOP_STATIC_EXPORT === '1';

const shouldStaticExport =
  forceDesktopStaticExport || process.env[ANYDOCS_RUNTIME_ENV.docsRuntime] === DOCS_RUNTIME_MODES.export;

const nextConfig = {
  reactStrictMode: true,
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
  // The Try-it panel always calls the same-origin path `/try-it/invoke`. How that resolves depends on
  // the runtime, but the browser never talks to the proxy cross-origin:
  //   - Preview / any reader server: set ANYDOCS_TRYIT_PROXY_ORIGIN (e.g. http://127.0.0.1:3200) and the
  //     dev server reverse-proxies `/try-it/invoke` to the standalone Try-it proxy — the SAME service and
  //     code path used in production, so what you test in preview matches prod.
  //   - Studio (CLI) mode: leave ANYDOCS_TRYIT_PROXY_ORIGIN unset to use the in-process local API route
  //     (`/api/local/try-it`), which is gated to the locked Studio project.
  //   - Production (static export): no Next server runs, so rewrites are skipped; nginx proxies `/try-it/`
  //     to the standalone proxy instead (see the docs project's nginx.conf).
  async rewrites() {
    if (shouldStaticExport) {
      return [];
    }
    const proxyOrigin = process.env.ANYDOCS_TRYIT_PROXY_ORIGIN?.trim().replace(/\/+$/, '');
    const destination = proxyOrigin ? `${proxyOrigin}/invoke` : '/api/local/try-it';
    return [{ source: '/try-it/invoke', destination }];
  },
};

export default nextConfig;
