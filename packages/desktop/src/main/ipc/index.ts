import { ipcMain, dialog, BrowserWindow } from 'electron'
import { readFile, writeFile, readdir, stat } from 'fs/promises'
import { join } from 'path'
import Store from 'electron-store'
import {
  getApiSources,
  getNavigation,
  getPage,
  getPages,
  getProject,
  postBuild,
  postPage,
  postPreview,
  putApiSources,
  putNavigation,
  putPage,
  putProject,
  removePage
} from './studio'

const StoreConstructor = (Store as typeof Store & { default?: typeof Store }).default ?? Store
const store = new StoreConstructor()

function toErrorPayload(error: unknown) {
  if (error instanceof Error) {
    return { code: 'IPC_ERROR', message: error.message }
  }

  return { code: 'IPC_ERROR', message: 'Unexpected IPC error' }
}

// File Operations IPC Handlers
const registerFileHandlers = (): void => {
  // Read file
  ipcMain.handle('file:read', async (_, filePath: string) => {
    try {
      const content = await readFile(filePath, 'utf-8')
      return { success: true, data: content }
    } catch (error: any) {
      return { success: false, error: { code: 'READ_ERROR', message: error.message } }
    }
  })

  // Write file
  ipcMain.handle('file:write', async (_, filePath: string, content: string) => {
    try {
      await writeFile(filePath, content, 'utf-8')
      return { success: true }
    } catch (error: any) {
      return { success: false, error: { code: 'WRITE_ERROR', message: error.message } }
    }
  })

  // List directory
  ipcMain.handle('file:list', async (_, dirPath: string) => {
    try {
      const entries = await readdir(dirPath, { withFileTypes: true })
      const files = await Promise.all(
        entries.map(async (entry) => {
          const fullPath = join(dirPath, entry.name)
          const stats = await stat(fullPath)
          return {
            name: entry.name,
            isDirectory: entry.isDirectory(),
            size: stats.size,
            modified: stats.mtime.toISOString()
          }
        })
      )
      return { success: true, data: files }
    } catch (error: any) {
      return { success: false, error: { code: 'LIST_ERROR', message: error.message } }
    }
  })

  // Select directory dialog
  ipcMain.handle('dialog:selectDirectory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    return { success: !result.canceled, data: result.filePaths[0] }
  })

  // Select file dialog
  ipcMain.handle('dialog:selectFile', async (_, filters?: { name: string; extensions: string[] }[]) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: filters || [{ name: 'All Files', extensions: ['*'] }]
    })
    return { success: !result.canceled, data: result.filePaths[0] }
  })
}

const registerStudioHandlers = (): void => {
  ipcMain.handle('studio:project:get', async (_, projectId: string, customPath?: string) => {
    try {
      return { success: true, data: await getProject(projectId, customPath) }
    } catch (error) {
      return { success: false, error: toErrorPayload(error) }
    }
  })

  ipcMain.handle('studio:project:put', async (_, patch: unknown, projectId: string, customPath?: string) => {
    try {
      return { success: true, data: await putProject(patch as never, projectId, customPath) }
    } catch (error) {
      return { success: false, error: toErrorPayload(error) }
    }
  })

  ipcMain.handle('studio:pages:get', async (_, lang: string, projectId: string, customPath?: string) => {
    try {
      return { success: true, data: await getPages(lang as never, projectId, customPath) }
    } catch (error) {
      return { success: false, error: toErrorPayload(error) }
    }
  })

  ipcMain.handle('studio:page:get', async (_, lang: string, pageId: string, projectId: string, customPath?: string) => {
    try {
      return { success: true, data: await getPage(lang as never, pageId, projectId, customPath) }
    } catch (error) {
      return { success: false, error: toErrorPayload(error) }
    }
  })

  ipcMain.handle('studio:page:put', async (_, lang: string, page: unknown, projectId: string, customPath?: string) => {
    try {
      return { success: true, data: await putPage(lang as never, page as never, projectId, customPath) }
    } catch (error) {
      return { success: false, error: toErrorPayload(error) }
    }
  })

  ipcMain.handle(
    'studio:page:post',
    async (_, lang: string, input: { slug: string; title: string }, projectId: string, customPath?: string) => {
      try {
        return { success: true, data: await postPage(lang as never, input, projectId, customPath) }
      } catch (error) {
        return { success: false, error: toErrorPayload(error) }
      }
    }
  )

  ipcMain.handle(
    'studio:page:delete',
    async (_, lang: string, pageId: string, projectId: string, customPath?: string) => {
      try {
        return { success: true, data: await removePage(lang as never, pageId, projectId, customPath) }
      } catch (error) {
        return { success: false, error: toErrorPayload(error) }
      }
    }
  )

  ipcMain.handle('studio:navigation:get', async (_, lang: string, projectId: string, customPath?: string) => {
    try {
      return { success: true, data: await getNavigation(lang as never, projectId, customPath) }
    } catch (error) {
      return { success: false, error: toErrorPayload(error) }
    }
  })

  ipcMain.handle(
    'studio:navigation:put',
    async (_, lang: string, navigation: unknown, projectId: string, customPath?: string) => {
      try {
        return { success: true, data: await putNavigation(lang as never, navigation as never, projectId, customPath) }
      } catch (error) {
        return { success: false, error: toErrorPayload(error) }
      }
    }
  )

  ipcMain.handle('studio:api-sources:get', async (_, projectId: string, customPath?: string) => {
    try {
      return { success: true, data: await getApiSources(projectId, customPath) }
    } catch (error) {
      return { success: false, error: toErrorPayload(error) }
    }
  })

  ipcMain.handle('studio:api-sources:put', async (_, sources: unknown, projectId: string, customPath?: string) => {
    try {
      return { success: true, data: await putApiSources(sources as never, projectId, customPath) }
    } catch (error) {
      return { success: false, error: toErrorPayload(error) }
    }
  })

  ipcMain.handle('studio:build:post', async (_, projectId: string, customPath?: string) => {
    try {
      return { success: true, data: await postBuild(projectId, customPath) }
    } catch (error) {
      return { success: false, error: toErrorPayload(error) }
    }
  })

  ipcMain.handle('studio:preview:post', async (_, projectId: string, customPath?: string) => {
    try {
      return { success: true, data: await postPreview(projectId, customPath) }
    } catch (error) {
      return { success: false, error: toErrorPayload(error) }
    }
  })
}

// Window Operations IPC Handlers
const registerWindowHandlers = (): void => {
  ipcMain.handle('window:minimize', () => {
    const win = BrowserWindow.getFocusedWindow()
    if (win) win.minimize()
    return { success: true }
  })

  ipcMain.handle('window:maximize', () => {
    const win = BrowserWindow.getFocusedWindow()
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize()
      } else {
        win.maximize()
      }
    }
    return { success: true, data: win?.isMaximized() }
  })

  ipcMain.handle('window:close', () => {
    const win = BrowserWindow.getFocusedWindow()
    if (win) win.close()
    return { success: true }
  })

  ipcMain.handle('window:isMaximized', () => {
    const win = BrowserWindow.getFocusedWindow()
    return { success: true, data: win?.isMaximized() }
  })
}

// Store Operations IPC Handlers
const registerStoreHandlers = (): void => {
  ipcMain.handle('store:get', (_, key: string) => {
    return { success: true, data: store.get(key) }
  })

  ipcMain.handle('store:set', (_, key: string, value: any) => {
    store.set(key, value)
    return { success: true }
  })

  ipcMain.handle('store:delete', (_, key: string) => {
    store.delete(key)
    return { success: true }
  })
}

// Register all IPC handlers
export const registerIpcHandlers = (): void => {
  registerFileHandlers()
  registerStudioHandlers()
  registerWindowHandlers()
  registerStoreHandlers()
  console.log('[IPC] All handlers registered')
}
