/**
 * Story 8.4 — Cross-Mode Content Round-Trip Fixture Tests (NFR32).
 *
 * Proves that `doc-content-v1` pages and navigation survive a `web` <-> `desktop`
 * round trip byte-for-byte. Both modes run the SAME `@anydocs/core` repository
 * code; they differ only in the injected `FileSystemPort`:
 *
 *   - web    -> `createNodeFsPort()` over a real temp directory.
 *   - desktop -> `createDesktopFsPort()` over the production Tauri adapter, whose
 *               `invoke` is backed here by an in-memory emulator of the Story 9.2
 *               Rust fs commands (`fs_read`/`fs_write`/`fs_mkdir`/`fs_delete`/`fs_list`).
 *
 * The repositories serialize via `JSON.stringify(value, null, 2) + '\n'` and
 * `savePage`/`saveNavigation` apply only idempotent normalization (no timestamps),
 * so "open in the other mode and save without intentional changes" must reproduce
 * identical bytes. Any divergence here means a port is mutating content in transit.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, rm, readFile, readdir, mkdir, writeFile } from 'node:fs/promises';

import { createDocsRepository } from '../src/fs/docs-repository.ts';
import {
  initializeDocsRepository,
  loadNavigation,
  saveNavigation,
  loadPage,
  savePage,
} from '../src/fs/docs-repository.ts';
import { createNodeFsPort } from '../src/fs/node-fs-port.ts';
import { createDesktopFsPort, type TauriInvoke } from '../src/fs/desktop-fs-adapter.ts';
import { dirnamePosix } from '../src/utils/posix-path.ts';
import type { DocsLang, NavigationDoc, PageDoc } from '../src/types/docs.ts';

/** A flat map of project-root-relative posix path -> file contents (a "disk"). */
type Disk = Map<string, string>;

/** The fake absolute project root for the desktop side (never touches real fs). */
const DESKTOP_ROOT = '/proj';

// ---------------------------------------------------------------------------
// In-memory emulator of the Story 9.2 Rust fs commands, behind the real
// `createDesktopFsPort` adapter. Paths are project-root-relative posix strings,
// matching the contract exercised by desktop-fs-adapter.test.ts.
// ---------------------------------------------------------------------------

function createDesktopDisk(seed?: Disk): { invoke: TauriInvoke; files: Disk } {
  const files: Disk = new Map(seed ? [...seed] : []);
  const explicitDirs = new Set<string>();

  function recordDirs(rel: string): void {
    if (!rel || rel === '.') return;
    const parts = rel.split('/').filter(Boolean);
    let cur = '';
    for (const part of parts) {
      cur = cur ? `${cur}/${part}` : part;
      explicitDirs.add(cur);
    }
  }

  function dirExists(rel: string): boolean {
    if (rel === '' || rel === '.') return true;
    if (explicitDirs.has(rel)) return true;
    const prefix = `${rel}/`;
    for (const key of files.keys()) {
      if (key.startsWith(prefix)) return true;
    }
    return false;
  }

  // Seed implies the parent dirs of every seeded file exist.
  for (const key of files.keys()) recordDirs(dirnamePosix(key));

  const invoke: TauriInvoke = async (command, args) => {
    const p = (args?.path as string | undefined) ?? '';
    const notFound = (what: string) => ({ kind: 'notFound', message: `no such ${what}: ${p}` });

    switch (command) {
      case 'fs_read': {
        if (!files.has(p)) throw notFound('file');
        return files.get(p)!;
      }
      case 'fs_write': {
        files.set(p, args!.contents as string);
        recordDirs(dirnamePosix(p));
        return undefined;
      }
      case 'fs_mkdir': {
        recordDirs(p);
        return undefined;
      }
      case 'fs_delete': {
        if (!files.has(p)) throw notFound('file');
        files.delete(p);
        return undefined;
      }
      case 'fs_list': {
        if (!dirExists(p)) throw notFound('directory');
        const prefix = p === '' || p === '.' ? '' : `${p}/`;
        const entries = new Map<string, boolean>(); // name -> isDir
        for (const key of files.keys()) {
          if (prefix && !key.startsWith(prefix)) continue;
          const rest = prefix ? key.slice(prefix.length) : key;
          const slash = rest.indexOf('/');
          if (slash < 0) entries.set(rest, false);
          else entries.set(rest.slice(0, slash), true);
        }
        for (const dir of explicitDirs) {
          if (prefix && !dir.startsWith(prefix)) continue;
          const rest = prefix ? dir.slice(prefix.length) : dir;
          if (!rest || rest.includes('/')) continue;
          if (!entries.has(rest)) entries.set(rest, true);
        }
        return [...entries].map(([name, isDir]) => ({ name, isDir }));
      }
      default:
        throw { kind: 'io', message: `unknown command: ${command}` };
    }
  };

  return { invoke, files };
}

// ---------------------------------------------------------------------------
// Disk snapshot / seed / compare helpers.
// ---------------------------------------------------------------------------

async function snapshotNodeDisk(root: string): Promise<Disk> {
  const out: Disk = new Map();
  async function walk(absDir: string, relDir: string): Promise<void> {
    const entries = await readdir(absDir, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(absDir, entry.name);
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(abs, rel);
      else out.set(rel, await readFile(abs, 'utf8'));
    }
  }
  await walk(root, '');
  return out;
}

async function seedNodeDisk(root: string, disk: Disk): Promise<void> {
  for (const [rel, contents] of disk) {
    const abs = path.join(root, ...rel.split('/'));
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, contents, 'utf8');
  }
}

function assertDisksEqual(actual: Disk, expected: Disk, label: string): void {
  assert.deepEqual(
    [...actual.keys()].sort(),
    [...expected.keys()].sort(),
    `${label}: file set diverged`,
  );
  for (const [rel, bytes] of expected) {
    assert.equal(actual.get(rel), bytes, `${label}: bytes diverged for ${rel}`);
  }
  assert.ok(expected.size > 0, `${label}: fixture produced no files`);
}

// ---------------------------------------------------------------------------
// Reference project fixture (authored once, replayed through both modes).
// Uses `draft` status so the publication-approval gate stays out of scope.
// ---------------------------------------------------------------------------

const LANGS: DocsLang[] = ['en', 'zh'];

function text(value: string) {
  return { type: 'text' as const, text: value };
}

function page(lang: DocsLang, id: string, slug: string, title: string): PageDoc {
  return {
    id,
    lang,
    slug,
    title,
    description: `${title} (${lang})`,
    tags: ['guide', 'cross-mode'],
    status: 'draft',
    updatedAt: '2026-04-04T00:00:00.000Z',
    content: {
      version: 1,
      blocks: [
        { type: 'heading', id: 'block-1', level: 1, children: [text(title)] },
        {
          type: 'paragraph',
          id: 'block-2',
          children: [text('Round-trip fidelity must hold across web and desktop modes.')],
        },
        {
          type: 'list',
          id: 'block-3',
          style: 'bulleted',
          items: [
            { id: 'block-3-item-1', children: [text('byte-equivalent page payloads')] },
            { id: 'block-3-item-2', children: [text('unchanged navigation files')] },
          ],
        },
        {
          type: 'codeBlock',
          id: 'block-4',
          language: 'bash',
          code: 'pnpm --filter @anydocs/core test',
        },
      ],
    },
  };
}

function fixturePages(): PageDoc[] {
  return LANGS.flatMap((lang) => [
    page(lang, 'welcome', 'welcome', 'Welcome'),
    page(lang, 'guide', 'getting-started/guide', 'Guide'),
  ]);
}

function fixtureNavigation(lang: DocsLang): NavigationDoc {
  return {
    version: 1,
    items: [
      {
        type: 'section',
        title: `Getting Started (${lang})`,
        children: [
          { type: 'page', pageId: 'welcome' },
          {
            type: 'folder',
            title: 'Advanced',
            children: [
              { type: 'page', pageId: 'guide', titleOverride: 'The Guide' },
              { type: 'link', title: 'Anydocs', href: 'https://example.com/docs' },
            ],
          },
        ],
      },
    ],
  };
}

/** Author the full fixture project into a repository (any backing port). */
async function authorFixture(repository: ReturnType<typeof createDocsRepository>): Promise<void> {
  await initializeDocsRepository(repository, LANGS);
  for (const doc of fixturePages()) {
    await savePage(repository, doc.lang, doc);
  }
  for (const lang of LANGS) {
    await saveNavigation(repository, lang, fixtureNavigation(lang));
  }
}

/** Open every page + navigation file and re-save it unchanged (idempotent round trip). */
async function resaveWithoutChanges(
  repository: ReturnType<typeof createDocsRepository>,
): Promise<void> {
  for (const lang of LANGS) {
    for (const id of ['welcome', 'guide']) {
      const loaded = await loadPage(repository, lang, id);
      assert.ok(loaded, `expected to load ${lang}/${id}`);
      await savePage(repository, lang, loaded);
    }
    const nav = await loadNavigation(repository, lang);
    await saveNavigation(repository, lang, nav);
  }
}

// ---------------------------------------------------------------------------
// Tests.
// ---------------------------------------------------------------------------

test('web-authored project re-saved in desktop mode is byte-equivalent (NFR32)', async () => {
  const webRoot = await mkdtemp(path.join(os.tmpdir(), 'anydocs-xmode-web-'));
  try {
    // Author in web mode (real node fs).
    const webRepo = createDocsRepository(webRoot, createNodeFsPort());
    await authorFixture(webRepo);
    const webBytes = await snapshotNodeDisk(webRoot);

    // Open the same on-disk bytes in desktop mode and re-save without changes.
    const desktop = createDesktopDisk(webBytes);
    const desktopRepo = createDocsRepository(
      DESKTOP_ROOT,
      createDesktopFsPort({ projectRoot: DESKTOP_ROOT, invoke: desktop.invoke }),
    );
    await resaveWithoutChanges(desktopRepo);

    assertDisksEqual(desktop.files, webBytes, 'web -> desktop round trip');
  } finally {
    await rm(webRoot, { recursive: true, force: true });
  }
});

test('desktop-authored project re-saved in web mode is byte-equivalent (NFR32)', async () => {
  const webRoot = await mkdtemp(path.join(os.tmpdir(), 'anydocs-xmode-desktop-'));
  try {
    // Author in desktop mode (native fs adapter over the in-memory Rust emulator).
    const desktop = createDesktopDisk();
    const desktopRepo = createDocsRepository(
      DESKTOP_ROOT,
      createDesktopFsPort({ projectRoot: DESKTOP_ROOT, invoke: desktop.invoke }),
    );
    await authorFixture(desktopRepo);
    const desktopBytes = new Map(desktop.files);

    // Open the same bytes in web mode and re-save without changes.
    await seedNodeDisk(webRoot, desktopBytes);
    const webRepo = createDocsRepository(webRoot, createNodeFsPort());
    await resaveWithoutChanges(webRepo);

    assertDisksEqual(await snapshotNodeDisk(webRoot), desktopBytes, 'desktop -> web round trip');
  } finally {
    await rm(webRoot, { recursive: true, force: true });
  }
});

test('web and desktop modes author identical bytes from the same fixture', async () => {
  // Independent authoring (not a round trip): both ports must serialize the same
  // source fixture to identical on-disk bytes, proving neither port mutates content.
  const webRoot = await mkdtemp(path.join(os.tmpdir(), 'anydocs-xmode-parity-'));
  try {
    const webRepo = createDocsRepository(webRoot, createNodeFsPort());
    await authorFixture(webRepo);

    const desktop = createDesktopDisk();
    const desktopRepo = createDocsRepository(
      DESKTOP_ROOT,
      createDesktopFsPort({ projectRoot: DESKTOP_ROOT, invoke: desktop.invoke }),
    );
    await authorFixture(desktopRepo);

    assertDisksEqual(desktop.files, await snapshotNodeDisk(webRoot), 'web/desktop authoring parity');
  } finally {
    await rm(webRoot, { recursive: true, force: true });
  }
});
