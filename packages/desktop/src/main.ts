import './styles.css'

import { getBridgeState, hasNativeBridge, pickProjectDirectory } from './native-bridge'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('Missing #app root element.')
}

const shellMarkup = `
  <main class="shell">
    <section class="hero">
      <p class="eyebrow">Anydocs desktop</p>
      <h1>Tauri shell scaffold</h1>
      <p class="lede">
        This placeholder shell is ready for the future Studio frontend and
        Node desktop server. The native bridge is intentionally tiny for now.
      </p>
      <div class="actions">
        <button type="button" data-action="pick-directory">Select project directory</button>
        <button type="button" data-action="refresh">Refresh bridge state</button>
      </div>
    </section>

    <section class="panel">
      <div class="panel-row">
        <span class="label">Runtime</span>
        <span class="value" data-role="runtime-state">Detecting...</span>
      </div>
      <div class="panel-row">
        <span class="label">Bridge</span>
        <span class="value" data-role="bridge-state">Detecting...</span>
      </div>
      <div class="panel-row">
        <span class="label">Selected directory</span>
        <span class="value mono" data-role="selected-directory">None</span>
      </div>
    </section>
  </main>
`

app.innerHTML = shellMarkup

const runtimeState = app.querySelector<HTMLElement>('[data-role="runtime-state"]')
const bridgeState = app.querySelector<HTMLElement>('[data-role="bridge-state"]')
const selectedDirectory = app.querySelector<HTMLElement>('[data-role="selected-directory"]')
const pickDirectoryButton = app.querySelector<HTMLButtonElement>('[data-action="pick-directory"]')
const refreshButton = app.querySelector<HTMLButtonElement>('[data-action="refresh"]')

function setRuntimeLabel(): void {
  if (runtimeState) {
    runtimeState.textContent = hasNativeBridge() ? 'Tauri runtime' : 'Browser preview'
  }

  if (pickDirectoryButton) {
    pickDirectoryButton.disabled = !hasNativeBridge()
  }
}

async function refreshBridgeState(): Promise<void> {
  const state = await getBridgeState()
  if (!bridgeState) {
    return
  }

  bridgeState.textContent = state
    ? `${state.appName} ${state.version} on ${state.platform}`
    : 'Native bridge unavailable'
}

async function handlePickDirectory(): Promise<void> {
  const directory = await pickProjectDirectory()
  if (selectedDirectory) {
    selectedDirectory.textContent = directory ?? 'Selection cancelled'
  }
}

setRuntimeLabel()
void refreshBridgeState()

pickDirectoryButton?.addEventListener('click', () => {
  void handlePickDirectory()
})

refreshButton?.addEventListener('click', () => {
  void refreshBridgeState()
})
