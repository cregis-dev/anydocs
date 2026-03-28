import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const useExternalRenderer = process.env.ANYDOCS_DESKTOP_EXTERNAL_RENDERER === '1'
const sharedAliases = {
  '@anydocs/core': resolve('../core/src/index.ts')
}

export default defineConfig({
  main: {
    resolve: {
      alias: sharedAliases
    }
  },
  preload: {
    resolve: {
      alias: sharedAliases
    }
  },
  ...(useExternalRenderer
    ? {}
    : {
        renderer: {
          resolve: {
            alias: {
              ...sharedAliases,
              '@renderer': resolve('src/renderer/src')
            }
          },
          plugins: [react()]
        }
      })
})
