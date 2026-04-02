import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { initializeProject, updateProjectConfig } from '../../core/src/index.ts';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../../..');
const webRoot = path.resolve(scriptDir, '..');
const projectRoot = process.env.ANYDOCS_E2E_PROJECT_ROOT
  ? path.resolve(process.env.ANYDOCS_E2E_PROJECT_ROOT)
  : path.join(repoRoot, 'packages', '.tmp', 'playwright-anydocs-project');

async function prepareProject() {
  await rm(projectRoot, { recursive: true, force: true });
  await initializeProject({
    repoRoot: projectRoot,
    languages: ['en'],
    defaultLanguage: 'en',
  });

  const configResult = await updateProjectConfig(projectRoot, {
    authoring: {
      pageTemplates: [
        {
          id: 'adr',
          label: {
            en: 'ADR',
          },
          description: 'Architecture decision record',
          baseTemplate: 'reference',
          defaultSummary: 'Document the architectural decision and rationale.',
          metadataSchema: {
            fields: [
              {
                id: 'decision-status',
                label: {
                  en: 'Decision Status',
                },
                type: 'enum',
                required: true,
                visibility: 'public',
                options: ['proposed', 'accepted', 'superseded'],
              },
              {
                id: 'author',
                label: {
                  en: 'Author',
                },
                type: 'string',
                visibility: 'internal',
              },
            ],
          },
        },
      ],
    },
  });

  if (!configResult.ok) {
    throw configResult.error;
  }
}

function startStudioServer() {
  const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const child = spawn(pnpmCommand, ['dev'], {
    cwd: webRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      ANYDOCS_STUDIO_MODE: 'cli-single-project',
      ANYDOCS_STUDIO_PROJECT_ROOT: projectRoot,
      ANYDOCS_STUDIO_PROJECT_ID: 'default',
    },
  });

  const forwardSignal = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.on('SIGINT', () => forwardSignal('SIGINT'));
  process.on('SIGTERM', () => forwardSignal('SIGTERM'));

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

await prepareProject();
startStudioServer();
