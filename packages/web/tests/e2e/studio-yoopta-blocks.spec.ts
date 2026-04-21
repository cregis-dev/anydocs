import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import { e2eProjectRoot, studioUrl, waitForStudioSaved } from './support/studio';
import { isCliStudio } from './support/studio-mode';

const editorRegressionPagePath = path.join(e2eProjectRoot, 'pages', 'en', 'editor-regression.json');

test.describe.configure({ mode: 'serial' });

test('[P0] cli studio round-trips all supported editor blocks through the page editor @p0', async ({ page }) => {
  test.skip(!isCliStudio, 'Needs CLI Studio runtime.');
  test.setTimeout(60000);

  await page.goto(studioUrl);
  await expect(page.getByTestId('studio-pages-sidebar')).toBeVisible();

  await page
    .getByTestId('studio-pages-sidebar')
    .getByRole('button', { name: 'Editor Regression', exact: true })
    .click();

  const editor = page.getByTestId('studio-yoopta-editor').first();
  await expect(editor).toContainText('Editor Regression');
  await expect(editor).toContainText('This regression page exercises all supported blocks.');
  await expect(editor).toContainText('Studio route');
  await expect(editor).toContainText('Bulleted list item');
  await expect(editor).toContainText('Numbered list item');
  await expect(editor).toContainText('Todo list item');
  await expect(editor).toContainText('Blockquote content');
  await expect(editor).toContainText('pnpm --filter @anydocs/web test:e2e');
  await expect(editor).toContainText('pnpm build');
  await expect(editor).toContainText('page_set_status({ status: "published" })');
  await expect(editor).toContainText('Name');
  await expect(editor).toContainText('CLI Studio');
  await expect(editor).toContainText('Callout content');
  const image = editor.getByRole('img', { name: 'Regression image' });
  await image.scrollIntoViewIfNeeded();
  await expect(image).toBeVisible();
  const mermaid = page.getByTestId('studio-yoopta-mermaid');
  await mermaid.scrollIntoViewIfNeeded();
  await expect(mermaid).toBeVisible();

  const editableBlocks = editor.locator('[contenteditable="true"]');
  await editableBlocks.first().click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Updated');

  await waitForStudioSaved(page);

  const persistedPage = JSON.parse(await readFile(editorRegressionPagePath, 'utf8')) as {
    content: {
      blocks: Array<Record<string, unknown>>;
    };
  };
  const blockTypes = persistedPage.content.blocks.map((block) => block.type);

  expect(blockTypes).toEqual([
    'heading',
    'paragraph',
    'heading',
    'heading',
    'list',
    'list',
    'list',
    'blockquote',
    'codeBlock',
    'codeGroup',
    'image',
    'table',
    'callout',
    'divider',
    'mermaid',
  ]);

  const heading = persistedPage.content.blocks[0] as {
    children?: Array<{ text?: string }>;
  };
  expect(heading.children?.[0]?.text).toContain('Updated');

  const intro = persistedPage.content.blocks[1] as {
    children?: Array<{ type?: string; text?: string; href?: string; children?: Array<{ text?: string }> }>;
  };
  expect(intro.children?.some((child) => child.type === 'link' && child.href === '/studio')).toBe(true);

  const todoList = persistedPage.content.blocks[6] as {
    items?: Array<{ checked?: boolean }>;
  };
  expect(todoList.items?.[0]?.checked).toBe(false);

  const mermaidBlock = persistedPage.content.blocks.find((block) => block.type === 'mermaid') as
    | {
        code?: string;
        title?: string;
      }
    | undefined;
  expect(mermaidBlock).toBeTruthy();
  expect(mermaidBlock?.title).toBe('Regression Diagram');
  expect(mermaidBlock?.code).toContain('Review --> Published');
});
