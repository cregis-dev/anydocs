import {
  ANYDOCS_RUNTIME_ENV,
  DOCS_RUNTIME_MODES,
  isCliDocsRuntimeModeValue,
  isCliStudioModeValue,
} from '@anydocs/core/runtime-contract';

export type CliStudioRuntime = {
  kind: 'cli';
  lockedProjectRoot?: string;
  lockedProjectId?: string;
};

export type DesktopStudioRuntime = {
  kind: 'desktop';
  serverBaseUrl?: string;
};

export type StudioRuntimeConfig = CliStudioRuntime | DesktopStudioRuntime | null;

export type CliDocsRuntimeMode = 'export' | 'preview';

export type CliDocsRuntimeConfig = {
  mode: CliDocsRuntimeMode;
  projectRoot: string;
  projectId: string;
} | null;

export type RuntimeConfig = {
  studio: StudioRuntimeConfig;
  docs: CliDocsRuntimeConfig;
  isDesktopRuntime: boolean;
};

const DEFAULT_DESKTOP_SERVER_BASE_URL = 'http://127.0.0.1:33440';

export function normalizeOptionalString(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function isCliStudioMode(mode?: string | null): mode is 'cli' | 'cli-single-project' {
  return isCliStudioModeValue(mode);
}

export function isDesktopRuntimeFlagEnabled(): boolean {
  return process.env[ANYDOCS_RUNTIME_ENV.desktopRuntime] === '1';
}

export function readCliDocsRuntimeMode(): CliDocsRuntimeMode | null {
  const mode = process.env[ANYDOCS_RUNTIME_ENV.docsRuntime];
  if (isCliDocsRuntimeModeValue(mode)) {
    return mode === DOCS_RUNTIME_MODES.export ? DOCS_RUNTIME_MODES.export : DOCS_RUNTIME_MODES.preview;
  }

  return null;
}

export function readRuntimeConfig(): RuntimeConfig {
  const docsMode = readCliDocsRuntimeMode();
  const docsProjectRoot = normalizeOptionalString(process.env[ANYDOCS_RUNTIME_ENV.docsProjectRoot]);
  const isDesktopRuntime = isDesktopRuntimeFlagEnabled();

  const studio = isCliStudioMode(process.env[ANYDOCS_RUNTIME_ENV.studioMode])
    ? {
        kind: 'cli' as const,
        lockedProjectRoot: normalizeOptionalString(process.env[ANYDOCS_RUNTIME_ENV.studioProjectRoot]),
        lockedProjectId: normalizeOptionalString(process.env[ANYDOCS_RUNTIME_ENV.studioProjectId]),
      }
    : isDesktopRuntime
      ? {
          kind: 'desktop' as const,
          serverBaseUrl:
            normalizeOptionalString(process.env[ANYDOCS_RUNTIME_ENV.desktopServerUrl]) ??
            DEFAULT_DESKTOP_SERVER_BASE_URL,
        }
      : null;

  const docs =
    docsMode && docsProjectRoot
      ? {
          mode: docsMode,
          projectRoot: docsProjectRoot,
          projectId: normalizeOptionalString(process.env[ANYDOCS_RUNTIME_ENV.docsProjectId]) ?? '',
        }
      : null;

  return {
    studio,
    docs,
    isDesktopRuntime,
  };
}
