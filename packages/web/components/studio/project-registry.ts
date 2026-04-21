'use client';

import {
  hasNativeDesktopBridge,
  pickNativeDesktopProjectDirectory,
} from '@/components/studio/native-desktop-bridge';

export interface StudioProject {
  id: string;
  name: string;
  path: string;
  lastOpened: number;
}

const STORAGE_KEY = 'studio-projects';
const ABSOLUTE_PATH_PATTERN = /^(?:[A-Za-z]:[\\/]|\/)/;

function encodeProjectKey(value: string): string {
  const normalized = value.trim().toLowerCase();
  let hash = 5381;

  for (const char of normalized) {
    hash = ((hash << 5) + hash + char.codePointAt(0)!) >>> 0;
  }

  return `project-${hash.toString(36)}`;
}

function normalizeProjectName(projectPath: string): string {
  return projectPath.split(/[\\/]+/).filter(Boolean).at(-1) ?? projectPath;
}

function normalizeStoredProject(value: unknown): StudioProject | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const raw = value as Partial<StudioProject>;
  if (typeof raw.path !== 'string' || !isAbsoluteProjectPath(raw.path)) {
    return null;
  }

  const path = raw.path.trim();
  const name = typeof raw.name === 'string' && raw.name.trim().length > 0
    ? raw.name.trim()
    : normalizeProjectName(path);
  const id = typeof raw.id === 'string' && raw.id.trim().length > 0
    ? raw.id.trim()
    : generateProjectId(path);
  const lastOpened = typeof raw.lastOpened === 'number' && Number.isFinite(raw.lastOpened)
    ? raw.lastOpened
    : Date.now();

  return { id, name, path, lastOpened };
}

function sanitizeStoredProjects(value: unknown): StudioProject[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seenPaths = new Set<string>();
  const projects: StudioProject[] = [];

  for (const item of value) {
    const project = normalizeStoredProject(item);
    if (!project) {
      continue;
    }

    const key = project.path.toLowerCase();
    if (seenPaths.has(key)) {
      continue;
    }

    seenPaths.add(key);
    projects.push(project);
  }

  return projects.sort((a, b) => b.lastOpened - a.lastOpened);
}

export function isAbsoluteProjectPath(projectPath: string): boolean {
  return ABSOLUTE_PATH_PATTERN.test(projectPath.trim());
}

export function normalizeAbsoluteProjectPath(projectPath: string): string {
  const normalizedPath = projectPath.trim();

  if (!isAbsoluteProjectPath(normalizedPath)) {
    throw new Error('请输入文档项目根目录的绝对路径。');
  }

  return normalizedPath;
}

export function hasNativeDirectoryPicker(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return hasNativeDesktopBridge();
}

export function generateProjectId(projectPath: string): string {
  return encodeProjectKey(projectPath);
}

export function loadProjectsFromStorage(): StudioProject[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return sanitizeStoredProjects(stored ? JSON.parse(stored) : []);
  } catch {
    return [];
  }
}

export function saveProjectsToStorage(projects: StudioProject[]) {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeStoredProjects(projects)));
}

export function getProjectPath(projectId: string): string | undefined {
  return loadProjectsFromStorage().find((project) => project.id === projectId)?.path;
}

export function registerRecentProject(projects: StudioProject[], projectPath: string): {
  current: StudioProject;
  projects: StudioProject[];
} {
  const normalizedPath = projectPath.trim();
  const current: StudioProject = {
    id: generateProjectId(normalizedPath),
    name: normalizeProjectName(normalizedPath),
    path: normalizedPath,
    lastOpened: Date.now(),
  };

  const nextProjects = [
    current,
    ...projects.filter((project) => project.path.toLowerCase() !== normalizedPath.toLowerCase()),
  ].sort((a, b) => b.lastOpened - a.lastOpened);

  return {
    current,
    projects: sanitizeStoredProjects(nextProjects),
  };
}

export function removeRecentProject(projects: StudioProject[], projectId: string): StudioProject[] {
  return sanitizeStoredProjects(projects.filter((project) => project.id !== projectId));
}

export async function pickNativeProjectPath(): Promise<string | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  const path = await pickNativeDesktopProjectDirectory();
  if (!path) {
    return null;
  }

  return normalizeAbsoluteProjectPath(path);
}
