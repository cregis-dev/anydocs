export const ANYDOCS_RUNTIME_ENV: {
  readonly studioMode: 'ANYDOCS_STUDIO_MODE';
  readonly studioProjectRoot: 'ANYDOCS_STUDIO_PROJECT_ROOT';
  readonly studioProjectId: 'ANYDOCS_STUDIO_PROJECT_ID';
  readonly desktopRuntime: 'ANYDOCS_DESKTOP_RUNTIME';
  readonly desktopServerUrl: 'ANYDOCS_DESKTOP_SERVER_URL';
  readonly docsRuntime: 'ANYDOCS_DOCS_RUNTIME';
  readonly docsProjectRoot: 'ANYDOCS_DOCS_PROJECT_ROOT';
  readonly docsProjectId: 'ANYDOCS_DOCS_PROJECT_ID';
  readonly disableStudio: 'ANYDOCS_DISABLE_STUDIO';
};

export const STUDIO_RUNTIME_MODES: {
  readonly cli: 'cli';
  readonly legacyCli: 'cli-single-project';
  readonly desktop: 'desktop';
};

export const DOCS_RUNTIME_MODES: {
  readonly export: 'export';
  readonly preview: 'preview';
};

export function isCliStudioModeValue(value: string | null | undefined): value is 'cli' | 'cli-single-project';
export function isCliDocsRuntimeModeValue(value: string | null | undefined): value is 'export' | 'preview';
export function createCliStudioRuntimeEnv(input: {
  projectRoot: string;
  projectId: string;
}): Record<string, string>;
export function createDesktopRuntimeEnv(input?: {
  serverUrl?: string;
}): Record<string, string>;
export function createCliDocsRuntimeEnv(input: {
  mode: 'export' | 'preview';
  projectRoot: string;
  projectId?: string;
  disableStudio?: boolean;
}): Record<string, string>;
