import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ANYDOCS_RUNTIME_ENV,
  DOCS_RUNTIME_MODES,
  STUDIO_RUNTIME_MODES,
} from '@anydocs/core/runtime-contract';
import { readRuntimeConfig } from '../lib/runtime/runtime-config.ts';

const ORIGINAL_STUDIO_MODE = process.env[ANYDOCS_RUNTIME_ENV.studioMode];
const ORIGINAL_DESKTOP_RUNTIME = process.env[ANYDOCS_RUNTIME_ENV.desktopRuntime];
const ORIGINAL_DESKTOP_SERVER_URL = process.env[ANYDOCS_RUNTIME_ENV.desktopServerUrl];
const ORIGINAL_STUDIO_PROJECT_ROOT = process.env[ANYDOCS_RUNTIME_ENV.studioProjectRoot];
const ORIGINAL_STUDIO_PROJECT_ID = process.env[ANYDOCS_RUNTIME_ENV.studioProjectId];
const ORIGINAL_DOCS_RUNTIME = process.env[ANYDOCS_RUNTIME_ENV.docsRuntime];
const ORIGINAL_DOCS_PROJECT_ROOT = process.env[ANYDOCS_RUNTIME_ENV.docsProjectRoot];
const ORIGINAL_DOCS_PROJECT_ID = process.env[ANYDOCS_RUNTIME_ENV.docsProjectId];

function restoreEnv() {
  if (ORIGINAL_STUDIO_MODE === undefined) {
    delete process.env[ANYDOCS_RUNTIME_ENV.studioMode];
  } else {
    process.env[ANYDOCS_RUNTIME_ENV.studioMode] = ORIGINAL_STUDIO_MODE;
  }

  if (ORIGINAL_DESKTOP_RUNTIME === undefined) {
    delete process.env[ANYDOCS_RUNTIME_ENV.desktopRuntime];
  } else {
    process.env[ANYDOCS_RUNTIME_ENV.desktopRuntime] = ORIGINAL_DESKTOP_RUNTIME;
  }

  if (ORIGINAL_DESKTOP_SERVER_URL === undefined) {
    delete process.env[ANYDOCS_RUNTIME_ENV.desktopServerUrl];
  } else {
    process.env[ANYDOCS_RUNTIME_ENV.desktopServerUrl] = ORIGINAL_DESKTOP_SERVER_URL;
  }

  if (ORIGINAL_STUDIO_PROJECT_ROOT === undefined) {
    delete process.env[ANYDOCS_RUNTIME_ENV.studioProjectRoot];
  } else {
    process.env[ANYDOCS_RUNTIME_ENV.studioProjectRoot] = ORIGINAL_STUDIO_PROJECT_ROOT;
  }

  if (ORIGINAL_STUDIO_PROJECT_ID === undefined) {
    delete process.env[ANYDOCS_RUNTIME_ENV.studioProjectId];
  } else {
    process.env[ANYDOCS_RUNTIME_ENV.studioProjectId] = ORIGINAL_STUDIO_PROJECT_ID;
  }

  if (ORIGINAL_DOCS_RUNTIME === undefined) {
    delete process.env[ANYDOCS_RUNTIME_ENV.docsRuntime];
  } else {
    process.env[ANYDOCS_RUNTIME_ENV.docsRuntime] = ORIGINAL_DOCS_RUNTIME;
  }

  if (ORIGINAL_DOCS_PROJECT_ROOT === undefined) {
    delete process.env[ANYDOCS_RUNTIME_ENV.docsProjectRoot];
  } else {
    process.env[ANYDOCS_RUNTIME_ENV.docsProjectRoot] = ORIGINAL_DOCS_PROJECT_ROOT;
  }

  if (ORIGINAL_DOCS_PROJECT_ID === undefined) {
    delete process.env[ANYDOCS_RUNTIME_ENV.docsProjectId];
  } else {
    process.env[ANYDOCS_RUNTIME_ENV.docsProjectId] = ORIGINAL_DOCS_PROJECT_ID;
  }
}

test.afterEach(() => {
  restoreEnv();
});

test.after(() => {
  restoreEnv();
});

test('readRuntimeConfig returns disabled Studio and Docs runtimes by default', () => {
  delete process.env[ANYDOCS_RUNTIME_ENV.studioMode];
  delete process.env[ANYDOCS_RUNTIME_ENV.desktopRuntime];
  delete process.env[ANYDOCS_RUNTIME_ENV.desktopServerUrl];
  delete process.env[ANYDOCS_RUNTIME_ENV.studioProjectRoot];
  delete process.env[ANYDOCS_RUNTIME_ENV.studioProjectId];
  delete process.env[ANYDOCS_RUNTIME_ENV.docsRuntime];
  delete process.env[ANYDOCS_RUNTIME_ENV.docsProjectRoot];
  delete process.env[ANYDOCS_RUNTIME_ENV.docsProjectId];

  assert.deepEqual(readRuntimeConfig(), {
    studio: null,
    docs: null,
    isDesktopRuntime: false,
  });
});

test('readRuntimeConfig resolves the locked CLI Studio runtime', () => {
  process.env[ANYDOCS_RUNTIME_ENV.studioMode] = STUDIO_RUNTIME_MODES.cli;
  process.env[ANYDOCS_RUNTIME_ENV.studioProjectRoot] = '/tmp/anydocs-project';
  process.env[ANYDOCS_RUNTIME_ENV.studioProjectId] = 'starter-docs';
  delete process.env[ANYDOCS_RUNTIME_ENV.desktopRuntime];

  assert.deepEqual(readRuntimeConfig().studio, {
    kind: 'cli',
    lockedProjectRoot: '/tmp/anydocs-project',
    lockedProjectId: 'starter-docs',
  });
});

test('readRuntimeConfig resolves the desktop Studio runtime', () => {
  delete process.env[ANYDOCS_RUNTIME_ENV.studioMode];
  delete process.env[ANYDOCS_RUNTIME_ENV.studioProjectRoot];
  delete process.env[ANYDOCS_RUNTIME_ENV.studioProjectId];
  process.env[ANYDOCS_RUNTIME_ENV.desktopRuntime] = '1';
  process.env[ANYDOCS_RUNTIME_ENV.desktopServerUrl] = 'http://127.0.0.1:33440';

  assert.deepEqual(readRuntimeConfig().studio, {
    kind: 'desktop',
    serverBaseUrl: 'http://127.0.0.1:33440',
  });
});

test('readRuntimeConfig resolves the CLI docs runtime when project root is provided', () => {
  process.env[ANYDOCS_RUNTIME_ENV.docsRuntime] = DOCS_RUNTIME_MODES.preview;
  process.env[ANYDOCS_RUNTIME_ENV.docsProjectRoot] = '/tmp/preview-project';
  process.env[ANYDOCS_RUNTIME_ENV.docsProjectId] = 'preview-id';

  assert.deepEqual(readRuntimeConfig().docs, {
    mode: 'preview',
    projectRoot: '/tmp/preview-project',
    projectId: 'preview-id',
  });
});

test('readRuntimeConfig ignores an incomplete CLI docs runtime env', () => {
  process.env[ANYDOCS_RUNTIME_ENV.docsRuntime] = DOCS_RUNTIME_MODES.export;
  delete process.env[ANYDOCS_RUNTIME_ENV.docsProjectRoot];
  process.env[ANYDOCS_RUNTIME_ENV.docsProjectId] = 'ignored-project-id';

  assert.equal(readRuntimeConfig().docs, null);
});

test('readRuntimeConfig prefers explicit CLI Studio mode over desktop runtime', () => {
  process.env[ANYDOCS_RUNTIME_ENV.studioMode] = STUDIO_RUNTIME_MODES.cli;
  process.env[ANYDOCS_RUNTIME_ENV.studioProjectRoot] = '/tmp/locked-project';
  process.env[ANYDOCS_RUNTIME_ENV.desktopRuntime] = '1';

  assert.deepEqual(readRuntimeConfig().studio, {
    kind: 'cli',
    lockedProjectRoot: '/tmp/locked-project',
    lockedProjectId: undefined,
  });
});

test('readRuntimeConfig still accepts the legacy CLI Studio mode value', () => {
  process.env[ANYDOCS_RUNTIME_ENV.studioMode] = STUDIO_RUNTIME_MODES.legacyCli;
  process.env[ANYDOCS_RUNTIME_ENV.studioProjectRoot] = '/tmp/legacy-cli-project';

  assert.deepEqual(readRuntimeConfig().studio, {
    kind: 'cli',
    lockedProjectRoot: '/tmp/legacy-cli-project',
    lockedProjectId: undefined,
  });
});
