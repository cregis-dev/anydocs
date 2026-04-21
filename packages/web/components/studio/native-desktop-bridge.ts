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
