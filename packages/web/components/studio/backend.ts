'use client';

import { createDesktopHttpHost } from '@/components/studio/hosts/desktop-http-host';
import type { StudioHost } from '@/components/studio/hosts/host-types';
import { createWebLocalHost } from '@/components/studio/hosts/web-local-host';
import type { StudioBootContext } from '@/components/studio/studio-boot';

export * from '@/components/studio/hosts/host-types';

export function createStudioHost(bootContext: StudioBootContext): StudioHost {
  if (bootContext.mode === 'desktop') {
    if (!bootContext.serverBaseUrl) {
      throw new Error('Desktop Studio runtime is missing the local desktop server URL.');
    }

    return createDesktopHttpHost(bootContext.serverBaseUrl);
  }

  return createWebLocalHost();
}
