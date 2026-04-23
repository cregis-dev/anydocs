import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type PreviewSessionStatus = 'running' | 'stopping' | 'stopped' | 'exited';

export type PreviewSessionRecord = {
  id: string;
  projectRoot: string;
  projectId: string;
  host: string;
  port: number;
  url: string;
  docsPath: string;
  previewUrl: string;
  pid: number;
  publishedPages: number;
  startedAt: string;
  status: PreviewSessionStatus;
  exitCode?: number | null;
  signal?: NodeJS.Signals | null;
  endedAt?: string;
};

export type PreviewSessionHandle = {
  stop: () => Promise<void>;
  waitUntilExit: () => Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>;
};

type InternalSession = PreviewSessionRecord & {
  handle?: PreviewSessionHandle;
  stopPromise?: Promise<void>;
};

const sessions = new Map<string, InternalSession>();
const reconciled = new Set<string>();

function registryPath(projectRoot: string): string {
  return path.join(projectRoot, '.anydocs', 'preview.json');
}

function normalize(input: string): string {
  return path.resolve(input);
}

function toRecord(session: InternalSession): PreviewSessionRecord {
  const { handle: _handle, stopPromise: _stopPromise, ...record } = session;
  return record;
}

function isPidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means the process exists but we can't signal it
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

async function persistProjectRegistry(projectRoot: string): Promise<void> {
  const normalizedRoot = normalize(projectRoot);
  const records = [...sessions.values()]
    .filter((s) => normalize(s.projectRoot) === normalizedRoot)
    .map(toRecord);
  const file = registryPath(normalizedRoot);
  if (records.length === 0) {
    await rm(file, { force: true }).catch(() => undefined);
    return;
  }
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify({ version: 1, sessions: records }, null, 2), 'utf8');
}

export async function loadPersistedPreviewSessions(
  projectRoot: string,
): Promise<PreviewSessionRecord[]> {
  const normalizedRoot = normalize(projectRoot);
  const file = registryPath(normalizedRoot);
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      reconciled.add(normalizedRoot);
      return [];
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    reconciled.add(normalizedRoot);
    return [];
  }

  const records: PreviewSessionRecord[] = Array.isArray(
    (parsed as { sessions?: unknown })?.sessions,
  )
    ? ((parsed as { sessions: PreviewSessionRecord[] }).sessions ?? [])
    : [];

  let changed = false;
  for (const record of records) {
    if (sessions.has(record.id)) continue;
    if (record.status === 'running' || record.status === 'stopping') {
      if (!isPidAlive(record.pid)) {
        sessions.set(record.id, {
          ...record,
          status: 'exited',
          exitCode: record.exitCode ?? null,
          signal: record.signal ?? null,
          endedAt: record.endedAt ?? new Date().toISOString(),
        });
        changed = true;
      } else {
        sessions.set(record.id, { ...record });
      }
    } else {
      sessions.set(record.id, { ...record });
    }
  }

  reconciled.add(normalizedRoot);
  if (changed) {
    await persistProjectRegistry(normalizedRoot);
  }
  return [...sessions.values()]
    .filter((s) => normalize(s.projectRoot) === normalizedRoot)
    .map(toRecord);
}

async function ensureReconciled(projectRoot: string): Promise<void> {
  const normalizedRoot = normalize(projectRoot);
  if (reconciled.has(normalizedRoot)) return;
  await loadPersistedPreviewSessions(normalizedRoot);
}

function attachExitWatcher(session: InternalSession): void {
  if (!session.handle) return;
  void session.handle
    .waitUntilExit()
    .then(({ exitCode, signal }) => {
      if (session.status === 'stopped') return;
      session.status = session.status === 'stopping' ? 'stopped' : 'exited';
      session.exitCode = exitCode;
      session.signal = signal;
      session.endedAt = new Date().toISOString();
      void persistProjectRegistry(session.projectRoot);
    })
    .catch(() => {
      if (session.status === 'stopped') return;
      session.status = session.status === 'stopping' ? 'stopped' : 'exited';
      session.exitCode = null;
      session.signal = null;
      session.endedAt = new Date().toISOString();
      void persistProjectRegistry(session.projectRoot);
    });
}

export function registerPreviewSession(
  record: PreviewSessionRecord,
  handle: PreviewSessionHandle,
): PreviewSessionRecord {
  const session: InternalSession = { ...record, handle };
  sessions.set(record.id, session);
  attachExitWatcher(session);
  void persistProjectRegistry(session.projectRoot);
  return toRecord(session);
}

export async function getPreviewSession(id: string): Promise<PreviewSessionRecord | undefined> {
  const session = sessions.get(id);
  if (!session) return undefined;
  return toRecord(session);
}

export async function listPreviewSessionsForProject(
  projectRoot: string,
): Promise<PreviewSessionRecord[]> {
  await ensureReconciled(projectRoot);
  const normalizedRoot = normalize(projectRoot);
  return [...sessions.values()]
    .filter((s) => normalize(s.projectRoot) === normalizedRoot)
    .map(toRecord);
}

export async function listRunningPreviewSessions(
  projectRoot?: string,
): Promise<PreviewSessionRecord[]> {
  if (projectRoot) {
    await ensureReconciled(projectRoot);
  }
  const normalizedRoot = projectRoot == null ? undefined : normalize(projectRoot);
  return [...sessions.values()]
    .filter(
      (s) =>
        s.status === 'running' &&
        (normalizedRoot == null || normalize(s.projectRoot) === normalizedRoot),
    )
    .map(toRecord);
}

async function stopSingle(session: InternalSession): Promise<void> {
  if (session.status === 'stopped' || session.status === 'exited') {
    return;
  }
  if (session.stopPromise) {
    await session.stopPromise;
    return;
  }
  session.status = 'stopping';
  session.stopPromise = (async () => {
    if (session.handle) {
      try {
        await session.handle.stop();
        const exit = await session.handle.waitUntilExit();
        session.exitCode = exit.exitCode;
        session.signal = exit.signal;
      } catch {
        /* best-effort */
      }
    } else if (isPidAlive(session.pid)) {
      try {
        process.kill(session.pid, 'SIGTERM');
      } catch {
        /* already gone */
      }
    }
    session.status = 'stopped';
    session.endedAt = new Date().toISOString();
  })().finally(() => {
    session.stopPromise = undefined;
    void persistProjectRegistry(session.projectRoot);
  });
  await session.stopPromise;
}

export async function stopPreviewSession(id: string): Promise<void> {
  const session = sessions.get(id);
  if (!session) return;
  await stopSingle(session);
}

export async function stopAllPreviewSessions(projectRoot?: string): Promise<void> {
  const normalizedRoot = projectRoot == null ? undefined : normalize(projectRoot);
  const targets = [...sessions.values()].filter(
    (s) =>
      (s.status === 'running' || s.status === 'stopping') &&
      (normalizedRoot == null || normalize(s.projectRoot) === normalizedRoot),
  );
  await Promise.allSettled(targets.map((session) => stopSingle(session)));
}

export function clearPreviewRegistry(): void {
  sessions.clear();
  reconciled.clear();
}
