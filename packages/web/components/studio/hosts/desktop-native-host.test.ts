import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createDesktopNativeHost } from './desktop-native-host.ts';
import type { PageDoc, NavigationDoc } from '../../../lib/docs/types.ts';

const PROJECT_PATH = '/abs/project';

type FsError = { kind: string; message: string };

function notFound(path: string): FsError {
  return { kind: 'notFound', message: `not found: ${path}` };
}

/**
 * In-memory fake of the native Rust fs commands. Stores files keyed by
 * project-root-relative posix path. Directory listing is derived from the file
 * keys so a save→load round-trip works through the real repositories.
 */
function createFakeInvoke() {
  const files = new Map<string, string>();
  const calls: string[] = [];
  let activeRoot: string | null = null;

  const invoke = (async (command: string, args?: Record<string, unknown>) => {
    calls.push(command);
    const path = typeof args?.path === 'string' ? (args.path as string) : '';

    switch (command) {
      case 'set_active_project_root':
        activeRoot = path;
        return undefined;
      case 'fs_mkdir':
        return undefined;
      case 'fs_write':
        files.set(path, String(args?.contents ?? ''));
        return undefined;
      case 'fs_read': {
        const value = files.get(path);
        if (value === undefined) {
          throw notFound(path);
        }
        return value;
      }
      case 'fs_delete':
        files.delete(path);
        return undefined;
      case 'fs_list': {
        const prefix = path === '' || path === '.' ? '' : `${path}/`;
        const names = new Set<string>();
        let dirExists = path === '' || path === '.';
        for (const key of files.keys()) {
          if (!key.startsWith(prefix)) continue;
          dirExists = true;
          const rest = key.slice(prefix.length);
          const name = rest.split('/')[0];
          if (name) names.add(name);
        }
        if (!dirExists) {
          throw notFound(path);
        }
        return [...names].map((name) => ({ name }));
      }
      default:
        throw new Error(`unexpected invoke command: ${command}`);
    }
  }) as <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

  return {
    invoke,
    calls,
    files,
    getActiveRoot: () => activeRoot,
  };
}

function makePage(id: string, slug: string): PageDoc {
  return {
    id,
    lang: 'en',
    slug,
    title: id,
    status: 'draft',
    updatedAt: new Date().toISOString(),
    content: { version: 1, blocks: [] },
  } as PageDoc;
}

// Any real fetch attempt by the native doc-I/O path is a bug. Tests that exercise
// delegation install their own fetch spy.
function failingFetch(): typeof fetch {
  return (async () => {
    throw new Error('native doc I/O must not perform HTTP fetch');
  }) as typeof fetch;
}

test('native doc ops issue only fs_*/set_active_project_root invokes (no HTTP)', async () => {
  const fake = createFakeInvoke();
  globalThis.fetch = failingFetch();
  const host = createDesktopNativeHost({ invoke: fake.invoke, serverBaseUrl: 'http://localhost:9999' });

  // save → load round-trip through the native fake fs.
  const saved = await host.savePage('en', makePage('intro', 'getting-started'), 'p', PROJECT_PATH);
  assert.equal(saved.id, 'intro');

  const loaded = await host.getPage('en', 'intro', 'p', PROJECT_PATH);
  assert.equal(loaded.slug, 'getting-started');

  const { pages } = await host.getPages('en', 'p', PROJECT_PATH);
  assert.equal(pages.length, 1);

  // Every invoke command must be an fs_* or set_active_project_root.
  for (const command of fake.calls) {
    assert.ok(
      command === 'set_active_project_root' || command.startsWith('fs_'),
      `unexpected non-fs invoke: ${command}`,
    );
  }
});

test('set_active_project_root runs before the first fs op and is not repeated for the same root', async () => {
  const fake = createFakeInvoke();
  globalThis.fetch = failingFetch();
  const host = createDesktopNativeHost({ invoke: fake.invoke, serverBaseUrl: 'http://localhost:9999' });

  await host.getNavigation('en', 'p', PROJECT_PATH);
  await host.savePage('en', makePage('a', 'alpha'), 'p', PROJECT_PATH);
  await host.getApiSources('p', PROJECT_PATH);

  // First invoke overall must be the root activation.
  assert.equal(fake.calls[0], 'set_active_project_root');
  // First fs op must come after it.
  const firstFsIndex = fake.calls.findIndex((c) => c.startsWith('fs_'));
  assert.ok(firstFsIndex > 0, 'expected an fs op after set_active_project_root');
  // Exactly one activation for the single root.
  const rootCalls = fake.calls.filter((c) => c === 'set_active_project_root');
  assert.equal(rootCalls.length, 1);
  assert.equal(fake.getActiveRoot(), PROJECT_PATH);
});

test('switching project root re-activates the new root', async () => {
  const fake = createFakeInvoke();
  globalThis.fetch = failingFetch();
  const host = createDesktopNativeHost({ invoke: fake.invoke, serverBaseUrl: 'http://localhost:9999' });

  await host.getNavigation('en', 'p', '/abs/one');
  await host.getNavigation('en', 'p', '/abs/two');

  const rootCalls = fake.calls.filter((c) => c === 'set_active_project_root');
  assert.equal(rootCalls.length, 2);
});

test('getNavigation returns an empty doc for a fresh root', async () => {
  const fake = createFakeInvoke();
  globalThis.fetch = failingFetch();
  const host = createDesktopNativeHost({ invoke: fake.invoke, serverBaseUrl: 'http://localhost:9999' });

  const nav: NavigationDoc = await host.getNavigation('en', 'p', PROJECT_PATH);
  assert.equal(nav.version, 1);
  assert.deepEqual(nav.items, []);
});

test('getApiSources shapes results into StudioApiSourcesResponse', async () => {
  const fake = createFakeInvoke();
  globalThis.fetch = failingFetch();
  const host = createDesktopNativeHost({ invoke: fake.invoke, serverBaseUrl: 'http://localhost:9999' });

  const result = await host.getApiSources('p', PROJECT_PATH);
  assert.ok(Array.isArray(result.sources));
  assert.equal(result.sources.length, 0);
});

test('build/preview/getProject delegate to the HTTP host (fetch), never invoke', async () => {
  const fake = createFakeInvoke();
  const fetchCalls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    fetchCalls.push(String(input));
    return new Response(JSON.stringify({ success: true, data: {} }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  const host = createDesktopNativeHost({ invoke: fake.invoke, serverBaseUrl: 'http://localhost:9999' });

  await host.runBuild('p', PROJECT_PATH);
  await host.runPreview('p', PROJECT_PATH);
  await host.getProject('p', PROJECT_PATH);

  assert.equal(fetchCalls.length, 3, 'expected build/preview/getProject to each issue one fetch');
  // Delegated ops must not touch native fs / root activation.
  assert.equal(fake.calls.length, 0, 'delegated ops must not invoke native commands');
});
