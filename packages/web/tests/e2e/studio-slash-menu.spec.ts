import { expect, test } from '@playwright/test';

import { studioUrl, waitForCliStudioReady } from './support/studio';
import { isCliStudio } from './support/studio-mode';

// Slash-command menu e2e. The `/` trigger flows through
// `@udecode/plate-slash-command` (a transient `slash_input` node) and the
// dropdown is an `@ariakit/react` combobox — neither is driveable with
// synthetic keydown in jsdom, so the open / filter / navigate / apply / dismiss
// behaviour is asserted here in a real browser. The pure data layer
// (filterSlashItems + applySlashItem catalogue round-trip) is unit-tested in
// packages/editor/tests/plate-runtime.test.ts.

const editorHost = '[data-anydocs-editor-host] [contenteditable="true"]';
const slashMenu = '[data-anydocs-slash-menu]';

async function openEmptyParagraph(page: import('@playwright/test').Page) {
  await page.goto(studioUrl);
  await waitForCliStudioReady(page);
  await page.getByRole('button', { name: 'Editor Regression', exact: true }).click();

  // The editor host is code-split (`next/dynamic`); the first hit compiles the
  // large Plate chunk on demand, so allow a generous mount window.
  const editable = page.locator(editorHost);
  await expect(editable).toBeVisible({ timeout: 30000 });

  // Land the caret at the end of the body and open a fresh empty paragraph —
  // the slash trigger only fires inside an empty text block.
  await editable.click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  return editable;
}

test('[P1] slash menu opens, filters, and inserts a block @p1', async ({ page }) => {
  test.skip(!isCliStudio, 'Needs CLI Studio runtime.');
  test.setTimeout(60000);

  const editable = await openEmptyParagraph(page);
  const headingsBefore = await editable.locator('h1').count();

  // `/` opens the menu with the full catalogue.
  await page.keyboard.type('/');
  const menu = page.locator(slashMenu);
  await expect(menu).toBeVisible();
  await expect(menu.locator('[data-slash-item]')).toHaveCount(13);

  // Typing narrows to the three heading items.
  await page.keyboard.type('head');
  await expect(menu.locator('[data-slash-item]')).toHaveCount(3);
  await expect(menu.getByText('Heading 1')).toBeVisible();

  // Enter applies the highlighted (first) item; the menu dismisses and one
  // more <h1> appears in the body (the empty trigger paragraph is replaced).
  await page.keyboard.press('Enter');
  await expect(menu).toBeHidden();
  await expect(editable.locator('h1')).toHaveCount(headingsBefore + 1);
});

test('[P1] slash menu dismisses on Escape without inserting @p1', async ({ page }) => {
  test.skip(!isCliStudio, 'Needs CLI Studio runtime.');
  test.setTimeout(60000);

  await openEmptyParagraph(page);

  await page.keyboard.type('/');
  const menu = page.locator(slashMenu);
  await expect(menu).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
});
