import { ElectronAPI } from '@electron-toolkit/preload'

type IpcError = {
  code: string
  message: string
}

type FilterDescriptor = { name: string; extensions: string[] }

interface IpcResponse<T = unknown> {
  success: boolean
  data?: T
  error?: IpcError
}

interface FileApi {
  read: (filePath: string) => Promise<IpcResponse>
  write: (filePath: string, content: string) => Promise<IpcResponse>
  list: (dirPath: string) => Promise<IpcResponse>
}

interface DialogApi {
  selectDirectory: () => Promise<IpcResponse>
  selectFile: (filters?: FilterDescriptor[]) => Promise<IpcResponse>
}

interface NavApi {
  read: (lang: string) => Promise<IpcResponse>
  write: (lang: string, navData: unknown) => Promise<IpcResponse>
}

interface WindowApi {
  minimize: () => Promise<IpcResponse>
  maximize: () => Promise<IpcResponse>
  close: () => Promise<IpcResponse>
  isMaximized: () => Promise<IpcResponse>
}

interface StoreApi {
  get: (key: string) => Promise<IpcResponse>
  set: (key: string, value: unknown) => Promise<IpcResponse>
  delete: (key: string) => Promise<IpcResponse>
}

interface StudioApi {
  getProject: (projectId: string, projectPath?: string) => Promise<IpcResponse>
  updateProject: (patch: unknown, projectId: string, projectPath?: string) => Promise<IpcResponse>
  getPages: (lang: string, projectId: string, projectPath?: string) => Promise<IpcResponse>
  getPage: (
    lang: string,
    pageId: string,
    projectId: string,
    projectPath?: string
  ) => Promise<IpcResponse>
  savePage: (
    lang: string,
    page: unknown,
    projectId: string,
    projectPath?: string
  ) => Promise<IpcResponse>
  createPage: (
    lang: string,
    input: { slug: string; title: string },
    projectId: string,
    projectPath?: string
  ) => Promise<IpcResponse>
  deletePage: (
    lang: string,
    pageId: string,
    projectId: string,
    projectPath?: string
  ) => Promise<IpcResponse>
  getNavigation: (lang: string, projectId: string, projectPath?: string) => Promise<IpcResponse>
  saveNavigation: (
    lang: string,
    navigation: unknown,
    projectId: string,
    projectPath?: string
  ) => Promise<IpcResponse>
  getApiSources: (projectId: string, projectPath?: string) => Promise<IpcResponse>
  replaceApiSources: (
    sources: unknown,
    projectId: string,
    projectPath?: string
  ) => Promise<IpcResponse>
  runBuild: (projectId: string, projectPath?: string) => Promise<IpcResponse>
  runPreview: (projectId: string, projectPath?: string) => Promise<IpcResponse>
}

interface Api {
  file: FileApi
  dialog: DialogApi
  nav: NavApi
  window: WindowApi
  store: StoreApi
  studio: StudioApi
  onMenuEvent: (callback: (event: string) => void) => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
