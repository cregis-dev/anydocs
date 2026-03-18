import { contextBridge, ipcRenderer } from 'electron'

// Types for IPC communication
interface IpcResponse {
  success: boolean
  data?: any
  error?: { code: string; message: string }
}

// Expose protected methods to the renderer process
const api = {
  // File operations
  file: {
    read: (filePath: string): Promise<IpcResponse> => ipcRenderer.invoke('file:read', filePath),
    write: (filePath: string, content: string): Promise<IpcResponse> =>
      ipcRenderer.invoke('file:write', filePath, content),
    list: (dirPath: string): Promise<IpcResponse> => ipcRenderer.invoke('file:list', dirPath)
  },

  // Dialog operations
  dialog: {
    selectDirectory: (): Promise<IpcResponse> => ipcRenderer.invoke('dialog:selectDirectory'),
    selectFile: (filters?: { name: string; extensions: string[] }[]): Promise<IpcResponse> =>
      ipcRenderer.invoke('dialog:selectFile', filters)
  },

  // Navigation operations
  nav: {
    read: (lang: string): Promise<IpcResponse> => ipcRenderer.invoke('nav:read', lang),
    write: (lang: string, navData: any): Promise<IpcResponse> =>
      ipcRenderer.invoke('nav:write', lang, navData)
  },

  // Window operations
  window: {
    minimize: (): Promise<IpcResponse> => ipcRenderer.invoke('window:minimize'),
    maximize: (): Promise<IpcResponse> => ipcRenderer.invoke('window:maximize'),
    close: (): Promise<IpcResponse> => ipcRenderer.invoke('window:close'),
    isMaximized: (): Promise<IpcResponse> => ipcRenderer.invoke('window:isMaximized')
  },

  // Store operations (electron-store)
  store: {
    get: (key: string): Promise<IpcResponse> => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: any): Promise<IpcResponse> => ipcRenderer.invoke('store:set', key, value),
    delete: (key: string): Promise<IpcResponse> => ipcRenderer.invoke('store:delete', key)
  },

  studio: {
    getProject: (projectId: string, projectPath?: string): Promise<IpcResponse> =>
      ipcRenderer.invoke('studio:project:get', projectId, projectPath),
    updateProject: (patch: unknown, projectId: string, projectPath?: string): Promise<IpcResponse> =>
      ipcRenderer.invoke('studio:project:put', patch, projectId, projectPath),
    getPages: (lang: string, projectId: string, projectPath?: string): Promise<IpcResponse> =>
      ipcRenderer.invoke('studio:pages:get', lang, projectId, projectPath),
    getPage: (lang: string, pageId: string, projectId: string, projectPath?: string): Promise<IpcResponse> =>
      ipcRenderer.invoke('studio:page:get', lang, pageId, projectId, projectPath),
    savePage: (lang: string, page: unknown, projectId: string, projectPath?: string): Promise<IpcResponse> =>
      ipcRenderer.invoke('studio:page:put', lang, page, projectId, projectPath),
    createPage: (
      lang: string,
      input: { slug: string; title: string },
      projectId: string,
      projectPath?: string
    ): Promise<IpcResponse> => ipcRenderer.invoke('studio:page:post', lang, input, projectId, projectPath),
    deletePage: (lang: string, pageId: string, projectId: string, projectPath?: string): Promise<IpcResponse> =>
      ipcRenderer.invoke('studio:page:delete', lang, pageId, projectId, projectPath),
    getNavigation: (lang: string, projectId: string, projectPath?: string): Promise<IpcResponse> =>
      ipcRenderer.invoke('studio:navigation:get', lang, projectId, projectPath),
    saveNavigation: (
      lang: string,
      navigation: unknown,
      projectId: string,
      projectPath?: string
    ): Promise<IpcResponse> => ipcRenderer.invoke('studio:navigation:put', lang, navigation, projectId, projectPath),
    runBuild: (projectId: string, projectPath?: string): Promise<IpcResponse> =>
      ipcRenderer.invoke('studio:build:post', projectId, projectPath),
    runPreview: (projectId: string, projectPath?: string): Promise<IpcResponse> =>
      ipcRenderer.invoke('studio:preview:post', projectId, projectPath)
  },

  // Menu event listeners
  onMenuEvent: (callback: (event: string) => void): void => {
    ipcRenderer.on('menu:newPage', () => callback('newPage'))
    ipcRenderer.on('menu:openProject', () => callback('openProject'))
    ipcRenderer.on('menu:save', () => callback('save'))
  }
}

// Use contextBridge
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('[Preload] Error exposing API:', error)
  }
} else {
  // @ts-ignore
  window.api = api
}
