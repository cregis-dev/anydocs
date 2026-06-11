import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import {
  e2eProjectRoot,
  studioUrl,
  waitForCliStudioReady,
  waitForStudioSaved,
} from './support/studio';
import { isCliStudio } from './support/studio-mode';

// Regression coverage for user-input editing through the Plate-backed
// `@anydocs/editor` runtime. Every other Studio e2e spec edits metadata
// fields (title/description/tags) — none of them typed into the editor BODY,
// which is how the "user typing never dispatched a change event" runtime gap
// (Story 6.2's deferred user-input wiring) shipped without any P0 failing.
// This spec types into the contenteditable and asserts the text reaches the
// page JSON on disk — the full keystroke → change event → Studio dirty →
// autosave → filesystem pipeline.

const pagePath = path.join(e2eProjectRoot, 'pages', 'en', 'editor-regression.json');
const typedSentinel = 'typed-in-editor-sentinel';

test('[P0] cli studio persists body text typed into the block editor @p0', async ({ page }) => {
  test.skip(!isCliStudio, 'Needs CLI Studio runtime.');
  test.setTimeout(60000);

  await page.goto(studioUrl);
  await waitForCliStudioReady(page);

  await page.getByRole('button', { name: 'Editor Regression', exact: true }).click();

  // The editor host is code-split (`next/dynamic`) — the first hit compiles
  // the ~40-package Plate chunk on demand under the dev server, so give the
  // mount a generous window.
  const editable = page.locator('[data-anydocs-editor-host] [contenteditable="true"]');
  await expect(editable).toBeVisible({ timeout: 30000 });

  // Sanity: the sentinel must not already be present, or the disk assertion
  // below would pass vacuously on a stale project workspace.
  const before = await readFile(pagePath, 'utf8');
  expect(before).not.toContain(typedSentinel);

  // Click into the editor body, move the caret to a line end, and type.
  await editable.click();
  await page.keyboard.press('End');
  await page.keyboard.type(` ${typedSentinel}`);

  // Typing must flip the save status to dirty and autosave must complete.
  await waitForStudioSaved(page);

  const persisted = JSON.parse(await readFile(pagePath, 'utf8')) as {
    content: unknown;
  };
  expect(JSON.stringify(persisted.content)).toContain(typedSentinel);
});
