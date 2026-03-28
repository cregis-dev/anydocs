import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const webRoot = path.join(repoRoot, 'packages', 'web')
const desktopRoot = path.join(repoRoot, 'packages', 'desktop')
const rendererHost = process.env.ANYDOCS_DESKTOP_WEB_HOST || '127.0.0.1'
const rendererPort = process.env.ANYDOCS_DESKTOP_WEB_PORT || '3000'
const studioPath = process.env.ANYDOCS_DESKTOP_STUDIO_PATH || '/studio'
const rendererUrl = process.env.ELECTRON_RENDERER_URL || `http://${rendererHost}:${rendererPort}${studioPath}`
const baseUrl = new URL(rendererUrl)
const healthUrl = new URL(studioPath, `${baseUrl.protocol}//${baseUrl.host}`).toString()

let shuttingDown = false
const children = new Set()

function spawnProcess(label, command, args, env = process.env, cwd = repoRoot) {
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: 'inherit'
  })

  children.add(child)
  child.on('exit', (code, signal) => {
    children.delete(child)
    if (shuttingDown) {
      return
    }

    if (label === 'desktop') {
      shutdown(code ?? 0)
      return
    }

    if (code !== 0) {
      console.error(`[${label}] exited with code ${code ?? 'null'} signal ${signal ?? 'null'}`)
      shutdown(code ?? 1)
    }
  })
  child.on('error', (error) => {
    console.error(`[${label}] failed:`, error)
    shutdown(1)
  })

  return child
}

async function waitForServer(url, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(3000)
      })
      if (response.ok || response.status === 404) {
        return
      }
    } catch {
      // Server not ready yet.
    }

    await delay(1000)
  }

  throw new Error(`Timed out waiting for ${url}`)
}

function shutdown(code = 0) {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  for (const child of children) {
    child.kill('SIGTERM')
  }

  setTimeout(() => {
    for (const child of children) {
      child.kill('SIGKILL')
    }
  }, 5000).unref()

  process.exitCode = code
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

async function main() {
  spawnProcess('web', 'pnpm', [
    'exec',
    'next',
    'dev',
    '--hostname',
    rendererHost,
    '--port',
    rendererPort
  ], {
    ...process.env,
    ANYDOCS_DESKTOP_RUNTIME: '1'
  }, webRoot)

  await waitForServer(healthUrl)

  spawnProcess(
    'desktop',
    'pnpm',
    ['exec', 'electron-vite', 'dev', '--watch', '--ignoreConfigWarning'],
    {
      ...process.env,
      ANYDOCS_DESKTOP_EXTERNAL_RENDERER: '1',
      ELECTRON_RENDERER_URL: rendererUrl
    },
    desktopRoot
  )
}

main().catch((error) => {
  console.error(error)
  shutdown(1)
})
