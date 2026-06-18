'use client';

export type DesktopMenuAction = 'open-project' | 'new-page' | 'save';

const DESKTOP_MENU_EVENT_NAME = '__ANYDOCS_DESKTOP_MENU__';

type DirectDesktopBridge = {
  pickProjectDirectory?: () => Promise<string | null>;
  openLocalPath?: (path: string) => Promise<boolean>;
};

type TauriWindow = Window & {
  __TAURI_INTERNALS__?: {
    invoke?: <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
  };
  __ANYDOCS_DESKTOP_BRIDGE__?: DirectDesktopBridge;
};

function getWindowBridge(): DirectDesktopBridge | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const desktopWindow = window as TauriWindow;
  if (typeof desktopWindow.__ANYDOCS_DESKTOP_BRIDGE__?.pickProjectDirectory === 'function') {
    return desktopWindow.__ANYDOCS_DESKTOP_BRIDGE__;
  }

  const invoke = desktopWindow.__TAURI_INTERNALS__?.invoke;
  if (typeof invoke === 'function') {
    return {
      pickProjectDirectory: () => invoke<string | null>('pick_project_directory'),
      openLocalPath: (path) => invoke<boolean>('open_path', { path }),
    };
  }

  return null;
}

export function hasNativeDesktopBridge(): boolean {
  return getWindowBridge() !== null;
}

/**
 * Returns the raw Tauri `invoke` function from `window.__TAURI_INTERNALS__`, or
 * `null` when not running inside the native desktop webview (SSR, browser
 * preview, CLI). Story 9.5: the native StudioHost uses this to drive the Rust
 * fs commands and `set_active_project_root`.
 */
export function getDesktopInvoke(): (<T>(command: string, args?: Record<string, unknown>) => Promise<T>) | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const invoke = (window as TauriWindow).__TAURI_INTERNALS__?.invoke;
  return typeof invoke === 'function' ? invoke : null;
}

export async function pickNativeDesktopProjectDirectory(): Promise<string | null> {
  const bridge = getWindowBridge();
  if (!bridge?.pickProjectDirectory) {
    return null;
  }

  return bridge.pickProjectDirectory();
}

export function hasNativeDesktopPathOpener(): boolean {
  return typeof getWindowBridge()?.openLocalPath === 'function';
}

export async function openNativeDesktopPath(path: string): Promise<boolean> {
  const bridge = getWindowBridge();
  if (!bridge?.openLocalPath) {
    return false;
  }

  return bridge.openLocalPath(path);
}

export function onNativeDesktopMenuAction(
  listener: (action: DesktopMenuAction) => void,
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleEvent = (event: Event) => {
    const detail = (event as CustomEvent<{ action?: DesktopMenuAction }>).detail;
    if (!detail?.action) {
      return;
    }

    listener(detail.action);
  };

  window.addEventListener(DESKTOP_MENU_EVENT_NAME, handleEvent as EventListener);
  return () => {
    window.removeEventListener(DESKTOP_MENU_EVENT_NAME, handleEvent as EventListener);
  };
}
