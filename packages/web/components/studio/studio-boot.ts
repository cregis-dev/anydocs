import type { StudioProject } from '@/components/studio/project-registry';
import { generateProjectId } from '@/components/studio/project-registry';
import { readRuntimeConfig } from '@/lib/runtime/runtime-config';

export type StudioMode = 'cli' | 'desktop';

export type CliStudioBootContext = {
  mode: 'cli';
  lockedProjectRoot?: string;
  lockedProjectId?: string;
  canSwitchProjects: false;
  canOpenExternalProject: false;
  canManageRecentProjects: false;
};

export type DesktopStudioBootContext = {
  mode: 'desktop';
  lockedProjectRoot?: undefined;
  lockedProjectId?: undefined;
  serverBaseUrl?: string;
  canSwitchProjects: true;
  canOpenExternalProject: true;
  canManageRecentProjects: true;
};

export type StudioBootContext = CliStudioBootContext | DesktopStudioBootContext;

function getProjectNameFromPath(projectPath: string): string {
  return projectPath.split(/[\\/]+/).filter(Boolean).at(-1) ?? projectPath;
}

export function readStudioBootContext(): StudioBootContext | null {
  const runtime = readRuntimeConfig();

  if (runtime.studio?.kind === 'cli') {
    return {
      mode: 'cli',
      lockedProjectRoot: runtime.studio.lockedProjectRoot,
      lockedProjectId: runtime.studio.lockedProjectId,
      canSwitchProjects: false,
      canOpenExternalProject: false,
      canManageRecentProjects: false,
    };
  }

  if (runtime.studio?.kind === 'desktop') {
    return {
      mode: 'desktop',
      serverBaseUrl: runtime.studio.serverBaseUrl,
      canSwitchProjects: true,
      canOpenExternalProject: true,
      canManageRecentProjects: true,
    };
  }

  return null;
}

export function createLockedStudioProject(bootContext: StudioBootContext): StudioProject | null {
  if (!bootContext.lockedProjectRoot) {
    return null;
  }

  return {
    id: bootContext.lockedProjectId ?? generateProjectId(bootContext.lockedProjectRoot),
    name: getProjectNameFromPath(bootContext.lockedProjectRoot),
    path: bootContext.lockedProjectRoot,
    lastOpened: Date.now(),
  };
}
