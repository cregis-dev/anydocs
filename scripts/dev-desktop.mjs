import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const webRoot = path.join(repoRoot, 'packages', 'web')
const desktopRoot = path.join(repoRoot, 'packages', 'desktop')
const desktopServerRoot = path.join(repoRoot, 'packages', 'desktop-server')
const desktopServerHost = process.env.ANYDOCS_DESKTOP_SERVER_HOST || '127.0.0.1'
const desktopServerPort = process.env.ANYDOCS_DESKTOP_SERVER_PORT || '33440'
const desktopServerUrl = `http://${desktopServerHost}:${desktopServerPort}`
const rendererHost = process.env.ANYDOCS_DESKTOP_WEB_HOST || '127.0.0.1'
const rendererPort = process.env.ANYDOCS_DESKTOP_WEB_PORT || '3000'
const rendererUrl = process.env.ANYDOCS_DESKTOP_WEB_URL || `http://${rendererHost}:${rendererPort}/`
const healthUrl = new URL('/studio', rendererUrl).toString()

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
      console.error(
        '[%s] exited with code %s signal %s',
        label,
        code ?? 'null',
        signal ?? 'null'
      )
      shutdown(code ?? 1)
    }
  })
  child.on('error', (error) => {
    console.error('[%s] failed:', label, error)
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
  const desktopServerBuild = spawnProcess('desktop-server-build', 'pnpm', [
    '--filter',
    '@anydocs/desktop-server',
    'build'
  ], {
    ...process.env
  }, desktopServerRoot)
  await new Promise((resolve, reject) => {
    desktopServerBuild.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`desktop-server build failed with exit code ${code ?? 'null'}`))
    })
    desktopServerBuild.on('error', reject)
  })

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
    ANYDOCS_DESKTOP_RUNTIME: '1',
    ANYDOCS_DESKTOP_SERVER_URL: desktopServerUrl
  }, webRoot)

  await waitForServer(healthUrl)

  spawnProcess(
    'desktop',
    'pnpm',
    ['--filter', '@anydocs/desktop', 'tauri:dev'],
    {
      ...process.env,
      ANYDOCS_DESKTOP_RUNTIME: '1',
      ANYDOCS_DESKTOP_SERVER_URL: desktopServerUrl,
      ANYDOCS_DESKTOP_SERVER_HOST: desktopServerHost,
      ANYDOCS_DESKTOP_SERVER_PORT: desktopServerPort,
      ANYDOCS_DESKTOP_MANAGED_SERVER: '1'
    },
    desktopRoot
  )
}

main().catch((error) => {
  console.error(error)
  shutdown(1)
})
