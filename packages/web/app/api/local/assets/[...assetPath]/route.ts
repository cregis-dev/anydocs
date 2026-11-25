import { readRuntimeConfig } from '@/lib/runtime/runtime-config';
import { readStudioImage } from '@/lib/studio/server/image-assets';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ assetPath: string[] }> }) {
  const { studio } = readRuntimeConfig();
  if (studio?.kind !== 'cli' || !studio.lockedProjectRoot) return new Response(null, { status: 404 });

  const { assetPath } = await params;
  const asset = await readStudioImage(studio.lockedProjectRoot, assetPath);
  if (!asset) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(asset.bytes), {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': asset.type,
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      'Cross-Origin-Resource-Policy': 'same-origin',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
