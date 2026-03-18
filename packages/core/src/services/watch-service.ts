import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import { createDefaultProjectConfig } from '../config/project-config.ts';
import { loadProjectContract } from '../fs/content-repository.ts';

export type ProjectWatchOptions = {
  repoRoot: string;
  projectId?: string;
};

export type ProjectWatchTrigger = {
  eventType: string;
  targetPath: string;
  filename?: string;
};

export type ProjectWatchRunContext = {
  reason: 'initial' | 'change';
  runNumber: number;
  trigger?: ProjectWatchTrigger;
};

export type ProjectWatchLoopOptions<TResult> = ProjectWatchOptions & {
  debounceMs?: number;
  execute: (options: ProjectWatchOptions) => Promise<TResult>;
  signal: AbortSignal;
  onSuccess?: (result: TResult, context: ProjectWatchRunContext) => void | Promise<void>;
  onError?: (error: unknown, context: ProjectWatchRunContext) => void | Promise<void>;
};

const DEFAULT_DEBOUNCE_MS = 100;
const DEFAULT_POLL_INTERVAL_MS = 250;

type ProjectWatchState = {
  targets: string[];
  snapshot: Map<string, string>;
};

function normalizeTarget(targetPath: string): string {
  return path.resolve(targetPath);
}

function isMissingPathError(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT';
}

function shouldIgnoreSnapshotEntry(entryName: string): boolean {
  return entryName.endsWith('.tmp');
}

async function waitForDelay(signal: AbortSignal, delayMs: number): Promise<boolean> {
  if (signal.aborted) {
    return false;
  }

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, delayMs);

    const onAbort = () => {
      clearTimeout(timeout);
      resolve();
    };

    signal.addEventListener('abort', onAbort, { once: true });
  });

  return !signal.aborted;
}

async function captureDirectorySnapshot(rootPath: string, currentPath = rootPath): Promise<string[]> {
  let directoryEntries;

  try {
    directoryEntries = await readdir(currentPath, { withFileTypes: true });
  } catch (error: unknown) {
    if (isMissingPathError(error)) {
      return [];
    }

    throw error;
  }

  directoryEntries.sort((left, right) => left.name.localeCompare(right.name));

  const snapshotEntries: string[] = [];

  for (const entry of directoryEntries) {
    if (shouldIgnoreSnapshotEntry(entry.name)) {
      continue;
    }

    const absolutePath = path.join(currentPath, entry.name);
    const relativePath = path.relative(rootPath, absolutePath) || entry.name;

    let entryStats;
    try {
      entryStats = await stat(absolutePath);
    } catch (error: unknown) {
      if (isMissingPathError(error)) {
        continue;
      }

      throw error;
    }

    if (entryStats.isDirectory()) {
      snapshotEntries.push(`dir:${relativePath}`);
      snapshotEntries.push(...(await captureDirectorySnapshot(rootPath, absolutePath)));
      continue;
    }

    snapshotEntries.push(`file:${relativePath}:${entryStats.mtimeMs}:${entryStats.size}`);
  }

  return snapshotEntries;
}

async function captureTargetSnapshot(targetPath: string): Promise<string> {
  let targetStats;
  try {
    targetStats = await stat(targetPath);
  } catch (error: unknown) {
    if (isMissingPathError(error)) {
      return 'missing';
    }

    throw error;
  }

  if (!targetStats.isDirectory()) {
    return `file:${targetStats.mtimeMs}:${targetStats.size}`;
  }

  const entries = await captureDirectorySnapshot(targetPath);
  return `dir:${entries.join('|')}`;
}

async function captureProjectSnapshot(targets: string[]): Promise<Map<string, string>> {
  const snapshotEntries = await Promise.all(
    targets.map(async (targetPath) => [targetPath, await captureTargetSnapshot(targetPath)] as const),
  );

  return new Map(snapshotEntries);
}

function findChangedTarget(
  previousState: ProjectWatchState,
  nextState: ProjectWatchState,
): string | null {
  for (const [targetPath, previousSnapshot] of previousState.snapshot.entries()) {
    if (nextState.snapshot.get(targetPath) !== previousSnapshot) {
      return targetPath;
    }
  }

  for (const targetPath of nextState.snapshot.keys()) {
    if (!previousState.snapshot.has(targetPath)) {
      return targetPath;
    }
  }

  return null;
}

async function captureProjectWatchState(targets: string[]): Promise<ProjectWatchState> {
  return {
    targets,
    snapshot: await captureProjectSnapshot(targets),
  };
}

async function resolveProjectWatchState(options: ProjectWatchOptions): Promise<ProjectWatchState> {
  return captureProjectWatchState(await resolveProjectWatchTargets(options));
}

export async function resolveProjectWatchTargets(options: ProjectWatchOptions): Promise<string[]> {
  const projectId = options.projectId ?? createDefaultProjectConfig().projectId;
  const contractResult = await loadProjectContract(options.repoRoot, projectId);
  if (!contractResult.ok) {
    throw contractResult.error;
  }

  const contract = contractResult.value;
  const targets = new Set<string>([
    contract.paths.configFile,
    contract.paths.workflowFile,
    contract.paths.pagesRoot,
    contract.paths.navigationRoot,
  ]);

  return [...targets].map(normalizeTarget).sort();
}

export async function runProjectWatchLoop<TResult>(options: ProjectWatchLoopOptions<TResult>): Promise<void> {
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  let currentState = await resolveProjectWatchState(options);
  let runNumber = 0;

  const refreshState = async (): Promise<ProjectWatchState> => {
    try {
      return await resolveProjectWatchState(options);
    } catch (error: unknown) {
      // Keep polling the last known-good canonical targets so edits can recover the project.
      if (currentState.targets.length === 0) {
        throw error;
      }

      return captureProjectWatchState(currentState.targets);
    }
  };

  const executeRun = async (
    reason: 'initial' | 'change',
    observedState: ProjectWatchState,
    trigger?: ProjectWatchTrigger,
  ): Promise<ProjectWatchTrigger | null> => {
    runNumber += 1;
    const context: ProjectWatchRunContext = { reason, runNumber, ...(trigger ? { trigger } : {}) };
    const result = await options.execute({
      repoRoot: options.repoRoot,
      ...(options.projectId ? { projectId: options.projectId } : {}),
    });
    const nextState = await refreshState();
    const queuedTarget = findChangedTarget(observedState, nextState);
    currentState = nextState;
    await options.onSuccess?.(result, context);
    return queuedTarget
      ? {
          eventType: 'change',
          targetPath: queuedTarget,
        }
      : null;
  };

  const handleRunError = async (
    error: unknown,
    observedState: ProjectWatchState,
    trigger: ProjectWatchTrigger,
  ): Promise<ProjectWatchTrigger | null> => {
    await options.onError?.(error, {
      reason: 'change',
      runNumber: runNumber + 1,
      trigger,
    });
    const nextState = await refreshState();
    const queuedTarget = findChangedTarget(observedState, nextState);
    currentState = nextState;
    return queuedTarget
      ? {
          eventType: 'change',
          targetPath: queuedTarget,
        }
      : null;
  };

  let queuedTrigger = await executeRun('initial', currentState);

  while (!options.signal.aborted) {
    if (queuedTrigger) {
      const trigger = queuedTrigger;
      queuedTrigger = null;
      const observedState = currentState;

      try {
        queuedTrigger = await executeRun('change', observedState, trigger);
      } catch (error: unknown) {
        queuedTrigger = await handleRunError(error, observedState, trigger);
      }

      continue;
    }

    const shouldContinue = await waitForDelay(
      options.signal,
      Math.max(DEFAULT_POLL_INTERVAL_MS, debounceMs),
    );
    if (!shouldContinue) {
      break;
    }

    const nextState = await refreshState();
    const changedTarget = findChangedTarget(currentState, nextState);
    currentState = nextState;
    if (!changedTarget) {
      continue;
    }

    try {
      queuedTrigger = await executeRun('change', currentState, {
        eventType: 'change',
        targetPath: changedTarget,
      });
    } catch (error: unknown) {
      queuedTrigger = await handleRunError(error, currentState, {
        eventType: 'change',
        targetPath: changedTarget,
      });
    }
  }
}
