export type BridgeState = {
  appName: string
  platform: string
  runtime: 'tauri'
  version: string
}

type TauriWindow = Window & {
  __TAURI_INTERNALS__?: {
    invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T>
  }
}

function getTauriInvoke() {
  if (typeof window === 'undefined') {
    return null
  }

  return (window as TauriWindow).__TAURI_INTERNALS__?.invoke ?? null
}

export function hasNativeBridge(): boolean {
  return typeof getTauriInvoke() === 'function'
}

export async function getBridgeState(): Promise<BridgeState | null> {
  const invoke = getTauriInvoke()
  if (!invoke) {
    return null
  }

  return invoke<BridgeState>('get_bridge_state')
}

export async function pickProjectDirectory(): Promise<string | null> {
  const invoke = getTauriInvoke()
  if (!invoke) {
    return null
  }

  return invoke<string | null>('pick_project_directory')
}
