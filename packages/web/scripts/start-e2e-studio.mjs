import { spawn } from 'node:child_process';
import { access, cp, mkdir, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createPage, initializeProject, renderPageContent, updateProjectConfig } from '../../core/src/index.ts';
import { createCliStudioRuntimeEnv } from '@anydocs/core/runtime-contract';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../../..');
const sourceWebRoot = path.resolve(scriptDir, '..');
const webRoot = path.join(repoRoot, 'packages', '.web-studio-e2e-runtime');
const nextDistDir = '.next-cli-studio-e2e';
const appApiRoot = path.join(webRoot, 'app', 'api');
const hiddenApiRoot = path.join(webRoot, 'app', '__api_export_hidden__');
const projectRoot = process.env.ANYDOCS_E2E_PROJECT_ROOT
  ? path.resolve(process.env.ANYDOCS_E2E_PROJECT_ROOT)
  : path.join(repoRoot, 'packages', '.tmp', 'playwright-anydocs-project');

const editorRegressionContent = {
  version: 1,
  blocks: [
    {
      type: 'heading',
      id: 'editor-regression-h1',
      level: 1,
      children: [{ type: 'text', text: 'Editor Regression' }],
    },
    {
      type: 'paragraph',
      id: 'editor-regression-intro',
      children: [
        { type: 'text', text: 'This regression page exercises all supported blocks. Open the ' },
        {
          type: 'link',
          href: '/studio',
          title: 'Studio',
          children: [{ type: 'text', text: 'Studio route' }],
        },
        { type: 'text', text: ' and verify round-trip persistence.' },
      ],
    },
    {
      type: 'heading',
      id: 'editor-regression-h2',
      level: 2,
      children: [{ type: 'text', text: 'Block Coverage' }],
    },
    {
      type: 'heading',
      id: 'editor-regression-h3',
      level: 3,
      children: [{ type: 'text', text: 'Nested Coverage' }],
    },
    {
      type: 'list',
      id: 'editor-regression-bulleted',
      style: 'bulleted',
      items: [{ id: 'editor-bullet-1', children: [{ type: 'text', text: 'Bulleted list item' }] }],
    },
    {
      type: 'list',
      id: 'editor-regression-numbered',
      style: 'numbered',
      items: [{ id: 'editor-number-1', children: [{ type: 'text', text: 'Numbered list item' }] }],
    },
    {
      type: 'list',
      id: 'editor-regression-todo',
      style: 'todo',
      items: [{ id: 'editor-todo-1', checked: false, children: [{ type: 'text', text: 'Todo list item' }] }],
    },
    {
      type: 'blockquote',
      id: 'editor-regression-quote',
      children: [{ type: 'text', text: 'Blockquote content' }],
    },
    {
      type: 'codeBlock',
      id: 'editor-regression-code',
      language: 'bash',
      title: 'CLI',
      code: 'pnpm --filter @anydocs/web test:e2e',
    },
    {
      type: 'codeGroup',
      id: 'editor-regression-code-group',
      items: [
        { id: 'editor-regression-code-group-cli', title: 'CLI', language: 'bash', code: 'pnpm build' },
        {
          id: 'editor-regression-code-group-api',
          title: 'API',
          language: 'typescript',
          code: 'page_set_status({ status: "published" })',
        },
      ],
    },
    {
      type: 'image',
      id: 'editor-regression-image',
      src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="48" viewBox="0 0 96 48"><rect width="96" height="48" rx="8" fill="%230f172a"/><text x="48" y="29" fill="%23f8fafc" font-size="12" text-anchor="middle">E2E</text></svg>',
      alt: 'Regression image',
      caption: [{ type: 'text', text: 'Inline asset' }],
    },
    {
      type: 'table',
      id: 'editor-regression-table',
      rows: [
        {
          id: 'editor-regression-table-row-1',
          cells: [
            {
              id: 'editor-regression-table-cell-1-1',
              header: true,
              children: [{ type: 'text', text: 'Name' }],
            },
            {
              id: 'editor-regression-table-cell-1-2',
              header: true,
              children: [{ type: 'text', text: 'Value' }],
            },
          ],
        },
        {
          id: 'editor-regression-table-row-2',
          cells: [
            {
              id: 'editor-regression-table-cell-2-1',
              header: false,
              children: [{ type: 'text', text: 'Mode' }],
            },
            {
              id: 'editor-regression-table-cell-2-2',
              header: false,
              children: [{ type: 'text', text: 'CLI Studio' }],
            },
          ],
        },
      ],
    },
    {
      type: 'callout',
      id: 'editor-regression-callout',
      tone: 'warning',
      title: 'Warning',
      children: [{ type: 'text', text: 'Callout content' }],
    },
    {
      type: 'divider',
      id: 'editor-regression-divider',
    },
    {
      type: 'mermaid',
      id: 'editor-regression-mermaid',
      title: 'Regression Diagram',
      code: 'flowchart TD\n  Draft --> Review\n  Review --> Published',
    },
  ],
};

async function appendPageToNavigation(pageId) {
  const navigationPath = path.join(projectRoot, 'navigation', 'en.json');
  const navigation = JSON.parse(await readFile(navigationPath, 'utf8'));
  navigation.items.push({ type: 'page', pageId });
  await writeFile(navigationPath, `${JSON.stringify(navigation, null, 2)}\n`, 'utf8');
}

function shouldCopyRuntimeEntry(srcPath) {
  const relativePath = path.relative(sourceWebRoot, srcPath);
  if (!relativePath || relativePath === '') {
    return true;
  }

  if (relativePath.startsWith(`..${path.sep}`) || relativePath === '..') {
    return false;
  }

  const [topLevelName] = relativePath.split(path.sep);
  if (
    topLevelName === 'node_modules' ||
    topLevelName === 'test-results' ||
    topLevelName === 'playwright-report' ||
    topLevelName === 'coverage'
  ) {
    return false;
  }

  return !/^\.next($|-)/.test(topLevelName);
}

async function prepareRuntimeWorkspace() {
  await rm(webRoot, { recursive: true, force: true });
  await mkdir(path.dirname(webRoot), { recursive: true });
  await cp(sourceWebRoot, webRoot, {
    recursive: true,
    force: true,
    filter: shouldCopyRuntimeEntry,
  });
  await symlink(path.join(sourceWebRoot, 'node_modules'), path.join(webRoot, 'node_modules'), 'dir');
}

async function ensureStudioApiRoutesPresent() {
  const apiExists = await access(appApiRoot)
    .then(() => true)
    .catch(() => false);
  if (apiExists) {
    return;
  }

  const hiddenExists = await access(hiddenApiRoot)
    .then(() => true)
    .catch(() => false);
  if (!hiddenExists) {
    return;
  }

  await mkdir(path.dirname(appApiRoot), { recursive: true });
  await rename(hiddenApiRoot, appApiRoot);
}

async function prepareProject() {
  await ensureStudioApiRoutesPresent();
  await rm(projectRoot, { recursive: true, force: true });
  await rm(path.join(webRoot, nextDistDir), { recursive: true, force: true });
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

  const editorRegressionRender = renderPageContent(editorRegressionContent);
  await createPage({
    projectRoot,
    lang: 'en',
    page: {
      id: 'editor-regression',
      slug: 'editor-regression',
      title: 'Editor Regression',
      description: 'Draft page used to validate Studio editor coverage for supported blocks.',
      status: 'draft',
      content: editorRegressionContent,
      render: editorRegressionRender,
    },
  });
  await appendPageToNavigation('editor-regression');

  await createPage({
    projectRoot,
    lang: 'en',
    page: {
      id: 'review-gate',
      slug: 'review-gate',
      title: 'Review Gate',
      description: 'Page used to validate review approval and publish transitions.',
      template: 'blueprint-review',
      metadata: {
        'doc-type': 'review-note',
        'review-state': 'in-review',
        owner: 'QA',
        reviewer: 'Docs',
      },
      status: 'in_review',
      review: {
        required: true,
        sourceType: 'ai-generated',
        sourceId: 'e2e-review-source',
        itemId: 'review-gate-item',
        sourcePath: '/imports/review-gate.md',
        warnings: [
          {
            code: 'approval-required',
            message: 'This page must be explicitly approved before publication.',
            remediation: 'Approve the page in Studio before setting it to published.',
          },
        ],
      },
      content: {
        version: 1,
        blocks: [
          {
            type: 'paragraph',
            children: [{ type: 'text', text: 'Approval workflow regression coverage.' }],
          },
        ],
      },
      render: {
        markdown: 'Approval workflow regression coverage.',
        plainText: 'Approval workflow regression coverage.',
      },
    },
  });
  await appendPageToNavigation('review-gate');
}

function startStudioServer() {
  const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const child = spawn(pnpmCommand, ['dev'], {
    cwd: webRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      ...createCliStudioRuntimeEnv({
        projectRoot,
        projectId: 'default',
      }),
      ANYDOCS_NEXT_DIST_DIR: nextDistDir,
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
    rm(webRoot, { recursive: true, force: true })
      .catch((error) => {
        console.error(error);
      })
      .finally(() => {
        if (signal) {
          process.kill(process.pid, signal);
          return;
        }

        process.exit(code ?? 0);
      });
  });
}

await prepareRuntimeWorkspace();
await prepareProject();
startStudioServer();
