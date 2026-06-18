'use client';

import { createDesktopHttpHost } from '@/components/studio/hosts/desktop-http-host';
import { createDesktopNativeHost } from '@/components/studio/hosts/desktop-native-host';
import type { StudioHost } from '@/components/studio/hosts/host-types';
import { createWebLocalHost } from '@/components/studio/hosts/web-local-host';
import { getDesktopInvoke } from '@/components/studio/native-desktop-bridge';
import type { StudioBootContext } from '@/components/studio/studio-boot';

export * from '@/components/studio/hosts/host-types';

export function createStudioHost(bootContext: StudioBootContext): StudioHost {
  if (bootContext.mode === 'desktop') {
    if (!bootContext.serverBaseUrl) {
      throw new Error('Desktop Studio runtime is missing the local desktop server URL.');
    }

    // Prefer native Tauri fs for document I/O; fall back to the HTTP host when
    // `invoke` is unavailable (SSR, browser preview without Tauri internals).
    const invoke = getDesktopInvoke();
    if (invoke) {
      return createDesktopNativeHost({ invoke, serverBaseUrl: bootContext.serverBaseUrl });
    }

    return createDesktopHttpHost(bootContext.serverBaseUrl);
  }

  return createWebLocalHost();
}
