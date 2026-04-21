export const ANYDOCS_RUNTIME_ENV = Object.freeze({
  studioMode: 'ANYDOCS_STUDIO_MODE',
  studioProjectRoot: 'ANYDOCS_STUDIO_PROJECT_ROOT',
  studioProjectId: 'ANYDOCS_STUDIO_PROJECT_ID',
  desktopRuntime: 'ANYDOCS_DESKTOP_RUNTIME',
  desktopServerUrl: 'ANYDOCS_DESKTOP_SERVER_URL',
  docsRuntime: 'ANYDOCS_DOCS_RUNTIME',
  docsProjectRoot: 'ANYDOCS_DOCS_PROJECT_ROOT',
  docsProjectId: 'ANYDOCS_DOCS_PROJECT_ID',
  disableStudio: 'ANYDOCS_DISABLE_STUDIO',
});

export const STUDIO_RUNTIME_MODES = Object.freeze({
  cli: 'cli',
  legacyCli: 'cli-single-project',
  desktop: 'desktop',
});

export const DOCS_RUNTIME_MODES = Object.freeze({
  export: 'export',
  preview: 'preview',
});

export function isCliStudioModeValue(value) {
  return value === STUDIO_RUNTIME_MODES.cli || value === STUDIO_RUNTIME_MODES.legacyCli;
}

export function isCliDocsRuntimeModeValue(value) {
  return value === DOCS_RUNTIME_MODES.export || value === DOCS_RUNTIME_MODES.preview;
}

export function createCliStudioRuntimeEnv({ projectRoot, projectId }) {
  return {
    [ANYDOCS_RUNTIME_ENV.studioMode]: STUDIO_RUNTIME_MODES.cli,
    [ANYDOCS_RUNTIME_ENV.studioProjectRoot]: projectRoot,
    [ANYDOCS_RUNTIME_ENV.studioProjectId]: projectId,
  };
}

export function createDesktopRuntimeEnv({ serverUrl } = {}) {
  return {
    [ANYDOCS_RUNTIME_ENV.desktopRuntime]: '1',
    ...(serverUrl ? { [ANYDOCS_RUNTIME_ENV.desktopServerUrl]: serverUrl } : {}),
  };
}

export function createCliDocsRuntimeEnv({ mode, projectRoot, projectId, disableStudio = true }) {
  return {
    [ANYDOCS_RUNTIME_ENV.docsRuntime]: mode,
    [ANYDOCS_RUNTIME_ENV.docsProjectRoot]: projectRoot,
    ...(projectId ? { [ANYDOCS_RUNTIME_ENV.docsProjectId]: projectId } : {}),
    ...(disableStudio ? { [ANYDOCS_RUNTIME_ENV.disableStudio]: '1' } : {}),
  };
}
