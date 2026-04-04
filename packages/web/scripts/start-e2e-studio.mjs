import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createPage, initializeProject, updateProjectConfig } from '../../core/src/index.ts';

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
    site: {
      theme: {
        id: 'blueprint-review',
        branding: {
          siteTitle: 'Anydocs E2E',
          homeLabel: 'Docs Home',
        },
        codeTheme: 'github-dark',
      },
    },
    authoring: {
      pageTemplates: [
        {
          id: 'blueprint-review',
          label: {
            en: 'Blueprint Review',
          },
          description: 'Structured internal template for PRDs and technical specs.',
          baseTemplate: 'reference',
          defaultSummary: 'Capture the decision, scope, and review outcome in a format that is easy to scan.',
          defaultSections: [
            {
              title: 'Context',
              body: 'Explain why this document exists and what prompted the review.',
            },
            {
              title: 'Problem',
              body: 'Describe the user, product, or technical problem that needs to be solved.',
            },
            {
              title: 'Proposal',
              body: 'Summarize the recommended direction and the main changes it introduces.',
            },
            {
              title: 'Tradeoffs',
              body: 'Call out what the proposal deliberately does not solve or optimize.',
            },
            {
              title: 'Risks',
              body: 'List product, technical, and coordination risks together with mitigation ideas.',
            },
            {
              title: 'Open Questions',
              body: 'Capture the unresolved items that must be answered before approval.',
            },
            {
              title: 'Decision',
              body: 'Record the review outcome, owners, and next actions.',
            },
          ],
          metadataSchema: {
            fields: [
              {
                id: 'doc-type',
                label: {
                  en: 'Doc Type',
                },
                type: 'enum',
                required: true,
                visibility: 'public',
                options: ['prd', 'tech-spec', 'review-note'],
              },
              {
                id: 'review-state',
                label: {
                  en: 'Review State',
                },
                type: 'enum',
                required: true,
                visibility: 'public',
                options: ['draft', 'in-review', 'approved', 'blocked'],
              },
              {
                id: 'owner',
                label: {
                  en: 'Owner',
                },
                type: 'string',
                visibility: 'internal',
              },
              {
                id: 'reviewer',
                label: {
                  en: 'Reviewer',
                },
                type: 'string',
                visibility: 'internal',
              },
              {
                id: 'due-date',
                label: {
                  en: 'Due Date',
                },
                type: 'date',
                visibility: 'internal',
              },
            ],
          },
        },
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

  await createPage({
    projectRoot,
    lang: 'en',
    page: {
      id: 'blueprint-outline',
      slug: 'blueprint-outline',
      title: 'Blueprint Outline',
      description: 'Published page with multiple sections for TOC coverage.',
      template: 'blueprint-review',
      metadata: {
        'doc-type': 'tech-spec',
        'review-state': 'in-review',
        owner: 'Platform',
        reviewer: 'Product',
        'due-date': '2026-04-10',
      },
      status: 'published',
      content: {},
      render: {
        markdown: `# Blueprint Outline

## Context

This page exists to exercise the Blueprint Review TOC rail.

## Proposal

Keep the reader layout focused on the article body.

### Tradeoffs

The TOC is collapsed by default.

## Risks

Long pages still need fast heading navigation on mobile and desktop.
`,
        plainText:
          'Blueprint Outline Context This page exists to exercise the Blueprint Review TOC rail. Proposal Keep the reader layout focused on the article body. Tradeoffs The TOC is collapsed by default. Risks Long pages still need fast heading navigation on mobile and desktop.',
      },
    },
  });
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
