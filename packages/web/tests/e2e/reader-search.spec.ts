import { expect, test } from "@playwright/test";

const docsPreviewUrl = process.env.DOCS_PREVIEW_URL;
const docsPreviewOrigin = docsPreviewUrl
  ? new URL(docsPreviewUrl).origin
  : null;

function matchesSearchBootstrapResponse(
  response: import("@playwright/test").Response,
  lang: "en" | "zh",
) {
  if (!response.ok()) {
    return false;
  }

  const url = response.url();
  return (
    url.includes(`/api/docs/search-index?lang=${lang}`) ||
    url.includes(`/api/docs/search-find?lang=${lang}`)
  );
}

async function resolveReaderTheme(page: import("@playwright/test").Page) {
  if (
    await page
      .locator(".theme-blueprint-review")
      .first()
      .isVisible()
      .catch(() => false)
  ) {
    return "blueprint";
  }

  if (
    await page
      .locator(".theme-atlas-docs")
      .first()
      .isVisible()
      .catch(() => false)
  ) {
    return "atlas";
  }

  return "classic";
}

function getSearchScenario(
  theme: "classic" | "atlas" | "blueprint",
  lang: "en" | "zh",
) {
  if (theme === "blueprint") {
    return lang === "en"
      ? {
          query: "mitigation ideas",
          expectedTitle: /Blueprint Review/i,
          expectedMeta: "Risks",
          expectedSnippet: "mitigation ideas",
        }
      : {
          query: "主要变化",
          expectedTitle: /蓝图评审/i,
          expectedMeta: "Proposal",
          expectedSnippet: "主要变化",
        };
  }

  return lang === "en"
    ? {
        query: "project shape",
        expectedTitle: /Starter Docs Example/i,
        expectedMeta: "Getting Started",
        expectedSnippet: "project skeleton",
      }
    : {
        query: "双语页面",
        expectedTitle: /Starter Docs 示例/i,
        expectedMeta: "开始使用",
        expectedSnippet: "项目骨架",
      };
}

test.describe("Reader search", () => {
  test("[P1] english reader search opens as a modal and shows section-level results @p1", async ({
    page,
  }) => {
    test.skip(
      !docsPreviewOrigin,
      "Needs DOCS_PREVIEW_URL to verify reader preview routes.",
    );

    const searchIndexReady = page.waitForResponse((response) =>
      matchesSearchBootstrapResponse(response, "en"),
    );
    await page.goto(`${docsPreviewOrigin!}/en/welcome`, {
      waitUntil: "domcontentloaded",
    });
    await searchIndexReady;

    const theme = await resolveReaderTheme(page);
    const scenario = getSearchScenario(theme, "en");

    const searchTrigger = page
      .getByRole("button", { name: /find pages, sections, or keywords/i })
      .first();
    await expect(searchTrigger).toBeVisible();
    await searchTrigger.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const searchInput = dialog.getByRole("textbox", {
      name: /find pages, sections, or keywords/i,
    });
    await expect(searchInput).toBeFocused();

    await searchInput.fill(scenario.query);

    const result = dialog
      .getByRole("link", { name: scenario.expectedTitle })
      .first();
    await expect(result).toBeVisible();
    await expect(result).toContainText(scenario.expectedMeta);
    await expect(result).toContainText(scenario.expectedSnippet);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("[P1] localized reader search matches zh content and keeps section context @p1", async ({
    page,
  }) => {
    test.skip(
      !docsPreviewOrigin,
      "Needs DOCS_PREVIEW_URL to verify reader preview routes.",
    );

    const searchIndexReady = page.waitForResponse((response) =>
      matchesSearchBootstrapResponse(response, "zh"),
    );
    await page.goto(`${docsPreviewOrigin!}/zh/welcome`, {
      waitUntil: "domcontentloaded",
    });
    await searchIndexReady;

    const theme = await resolveReaderTheme(page);
    const scenario = getSearchScenario(theme, "zh");

    const searchTrigger = page
      .getByRole("button", { name: /查找页面、章节或关键词/i })
      .first();
    await expect(searchTrigger).toBeVisible();
    await searchTrigger.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const searchInput = dialog.getByRole("textbox", {
      name: /查找页面、章节或关键词/i,
    });
    await expect(searchInput).toBeFocused();

    await searchInput.fill(scenario.query);

    const result = dialog
      .getByRole("link", { name: scenario.expectedTitle })
      .first();
    await expect(result).toBeVisible();
    await expect(result).toContainText(scenario.expectedMeta);
    await expect(result).toContainText(scenario.expectedSnippet);
  });
});
