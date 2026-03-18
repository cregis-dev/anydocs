import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc'
import { createApplicationMenu } from './services/menu'

// Path to Next.js static export (relative to this file)
const getNextExportPath = (): string => {
  // In development/unpacked build, web/out is at ../web/out relative to desktop package
  const projectRoot = join(__dirname, '../../..')
  return join(projectRoot, 'web/out')
}

const getDevAppUrl = (): string => {
  return process.env['ELECTRON_RENDERER_URL'] || 'http://127.0.0.1:3000/studio'
}

function getProdAppPath(): string {
  // In packaged app, resources are at process.resourcesPath/app.asar
  if (process.resourcesPath) {
    return join(process.resourcesPath, 'app.asar', 'web/out')
  }
  // For unpacked build, try local web/out first, then fall back to monorepo path
  const localPath = join(__dirname, '../../web/out')
  const fs = require('fs')
  if (fs.existsSync(localPath)) {
    return localPath
  }
  return getNextExportPath()
}

function getProdEntryFile(nextExportPath: string): string {
  return join(nextExportPath, 'studio', 'index.html')
}

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Load content based on environment
  if (is.dev) {
    mainWindow.loadURL(getDevAppUrl())
  } else {
    // Production: Load from Next.js static export
    const nextExportPath = getProdAppPath()
    console.log('[Main] Loading from Next.js export:', nextExportPath)
    mainWindow.loadFile(getProdEntryFile(nextExportPath))
  }

  return mainWindow
}

// Export for use in other modules
export let mainWindow: BrowserWindow | null = null

app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.anydocs')

  // Default open or close DevTools by F12 in development
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Register IPC handlers
  registerIpcHandlers()

  // Create application menu
  createApplicationMenu()

  // Create main window
  mainWindow = createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
