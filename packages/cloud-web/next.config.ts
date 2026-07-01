import type { NextConfig } from 'next';

// cloud-web transpiles the workspace packages it consumes (they ship TS/ESM).
const nextConfig: NextConfig = {
  transpilePackages: ['@anydocs/editor', '@anydocs/cloud-core'],
};

export default nextConfig;
