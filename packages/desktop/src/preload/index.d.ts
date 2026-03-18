import { ElectronAPI } from '@electron-toolkit/preload'

interface IpcResponse {
  success: boolean
  data?: any
  error?: { code: string; message: string }
}

interface FileApi {
  read: (filePath: string) => Promise<IpcResponse>
  write: (filePath: string, content: string) => Promise<IpcResponse>
  list: (dirPath: string) => Promise<IpcResponse>
}

interface DialogApi {
  selectDirectory: () => Promise<IpcResponse>
  selectFile: (filters?: { name: string; extensions: string[] }[]) => Promise<IpcResponse>
}

interface NavApi {
  read: (lang: string) => Promise<IpcResponse>
  write: (lang: string, navData: any) => Promise<IpcResponse>
}

interface WindowApi {
  minimize: () => Promise<IpcResponse>
  maximize: () => Promise<IpcResponse>
  close: () => Promise<IpcResponse>
  isMaximized: () => Promise<IpcResponse>
}

interface StoreApi {
  get: (key: string) => Promise<IpcResponse>
  set: (key: string, value: any) => Promise<IpcResponse>
  delete: (key: string) => Promise<IpcResponse>
}

interface Api {
  file: FileApi
  dialog: DialogApi
  nav: NavApi
  window: WindowApi
  store: StoreApi
  onMenuEvent: (callback: (event: string) => void) => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
