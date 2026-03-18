// Test Utilities and Helpers

import { test as base, type Page, type Locator } from '@playwright/test';

/**
 * Extended test fixture with Studio-specific helpers
 */
export const studioTest = base.extend<{
  studioPage: StudioPage;
}>({
  studioPage: async ({ page }, use) => {
    const studioPage = new StudioPage(page);
    await use(studioPage);
  },
});

/**
 * Studio Page Object Model
 */
export class StudioPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto(process.env.STUDIO_URL || 'http://localhost:3000/');
    await this.page.waitForLoadState('networkidle');
  }

  async isWelcomeScreen(): Promise<boolean> {
    return this.page.locator('text=Anydocs Studio').isVisible().catch(() => false);
  }

  async waitForStudio() {
    await this.page.waitForSelector('text=PAGES', { timeout: 10000 }).catch(() => {
      // May not have project loaded yet
    });
  }

  // Navigation
  getLeftSidebar(): Locator {
    return this.page.locator('aside').first();
  }

  getRightSidebar(): Locator {
    return this.page.locator('aside').last();
  }

  getMainEditor(): Locator {
    return this.page.locator('main');
  }

  // Editor
  getEditor(): Locator {
    return this.page.locator('[contenteditable="true"]').first();
  }

  async typeInEditor(text: string) {
    const editor = this.getEditor();
    await editor.click();
    await editor.fill(text);
  }

  // Navigation Tree
  getNavTree(): Locator {
    return this.page.locator('[data-nav-tree], nav').first();
  }

  async selectNavItem(index: number = 0) {
    const item = this.page.locator('[data-nav-item]').nth(index);
    await item.click();
  }

  // Settings Panel
  getSettingsPanel(): Locator {
    return this.page.locator('text=DOCUMENT SETTINGS');
  }

  getTitleInput(): Locator {
    return this.page.locator('input').filter({ hasText: 'Display Title' }).first();
  }

  getSlugInput(): Locator {
    return this.page.locator('input').filter({ hasText: 'Slug' }).first();
  }

  getStatusSelect(): Locator {
    return this.page.locator('[role="combobox"]').filter({ hasText: 'Status' }).first();
  }

  // Actions
  async toggleLeftSidebar() {
    await this.page.locator('button[title*="Sidebar"]').first().click();
  }

  async toggleRightSidebar() {
    await this.page.locator('button[title*="Meta Panel"]').click();
  }

  async clickPreview(): Promise<Page> {
    const previewButton = this.page.locator('text=Preview');
    const [newPage] = await Promise.all([
      this.page.context().waitForEvent('page'),
      previewButton.click()
    ]);
    return newPage;
  }

  // Status
  getSaveStatus(): Locator {
    return this.page.locator('footer').locator('text=All changes saved, text=Unsaved changes, text=Saving...');
  }

  getConnectionStatus(): Locator {
    return this.page.locator('footer').locator('text=Connected, text=Disconnected');
  }

  // Language
  async switchLanguage(lang: 'zh' | 'en') {
    const button = this.page.locator(`button:has-text("${lang === 'zh' ? '中文' : 'EN'}")`);
    await button.click();
  }

  // Validation
  async getValidationErrors(): Promise<string[]> {
    const errorLocator = this.page.locator('[class*="text-red"]');
    const errors: string[] = [];
    const count = await errorLocator.count();
    for (let i = 0; i < count; i++) {
      const text = await errorLocator.nth(i).textContent();
      if (text) errors.push(text);
    }
    return errors;
  }
}

/**
 * Helper to skip tests on welcome screen
 */
export function skipIfWelcomeScreen(page: Page) {
  base.beforeEach(async ({ page }) => {
    await page.goto(process.env.STUDIO_URL || 'http://localhost:3000/');
    const welcome = await page.locator('text=DocEditor Studio').isVisible().catch(() => false);
    if (welcome) {
      base.skip(true, 'Needs project to be opened first');
    }
  });
}
