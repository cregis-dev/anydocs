interface Window {
  __TAURI_INTERNALS__?: {
    invoke?: <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
  };
  __ANYDOCS_DESKTOP_BRIDGE__?: {
    pickProjectDirectory?: () => Promise<string | null>;
    openLocalPath?: (path: string) => Promise<boolean>;
  };
}

interface WindowEventMap {
  __ANYDOCS_DESKTOP_MENU__: CustomEvent<{
    action?: 'open-project' | 'new-page' | 'save';
  }>;
}
