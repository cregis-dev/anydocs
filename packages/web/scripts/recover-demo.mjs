import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const DEFAULT_PROJECT_ID = 'demo';
const EXTERNAL_PROJECTS_ROOT = process.env.DOCS_PROJECTS_ROOT || '/Users/shawn/workspace/docs_home';

async function main() {
  console.log('Starting Demo recovery...');
  console.log('Target Root:', EXTERNAL_PROJECTS_ROOT);

  // 1. Ensure target directories exist
  const sourceRoot = path.join(EXTERNAL_PROJECTS_ROOT, DEFAULT_PROJECT_ID, 'source');
  await fs.mkdir(path.join(sourceRoot, 'pages', 'zh'), { recursive: true });
  await fs.mkdir(path.join(sourceRoot, 'pages', 'en'), { recursive: true });
  await fs.mkdir(path.join(sourceRoot, 'navigation'), { recursive: true });
  
  // Also create build directory if needed
  await fs.mkdir(path.join(EXTERNAL_PROJECTS_ROOT, DEFAULT_PROJECT_ID, 'build'), { recursive: true });

  // 2. Recover Navigation
  const langs = ['zh', 'en'];
  for (const lang of langs) {
    try {
      const navPath = path.join(process.cwd(), 'public', 'mcp', `navigation.${lang}.json`);
      const navContent = await fs.readFile(navPath, 'utf8');
      await fs.writeFile(path.join(sourceRoot, 'navigation', `${lang}.json`), navContent);
      console.log('[%s] Navigation recovered.', lang);
    } catch (e) {
      console.warn('[%s] Navigation recovery failed:', lang, e.message);
      // Create empty nav if missing
      await fs.writeFile(
        path.join(sourceRoot, 'navigation', `${lang}.json`), 
        JSON.stringify({ version: 1, items: [] }, null, 2)
      );
    }
  }

  // 3. Recover Pages (Metadata + Text Content)
  for (const lang of langs) {
    try {
      // Load metadata from pages.json
      const pagesMetaPath = path.join(process.cwd(), 'public', 'mcp', `pages.${lang}.json`);
      const pagesMeta = JSON.parse(await fs.readFile(pagesMetaPath, 'utf8'));
      
      // Load text content from search-index.json
      let searchIndex = { docs: [] };
      try {
        const searchIndexPath = path.join(process.cwd(), 'public', `search-index.${lang}.json`);
        searchIndex = JSON.parse(await fs.readFile(searchIndexPath, 'utf8'));
      } catch (e) {
        console.warn('[%s] Search index not found, text content will be empty.', lang);
      }

      const textMap = new Map();
      for (const doc of searchIndex.docs) {
        const pageId = doc.pageId || doc.id;
        const text = doc.text || '';
        if (!pageId || !text) {
          continue;
        }

        const existing = textMap.get(pageId);
        textMap.set(pageId, existing ? `${existing}\n\n${text}` : text);
      }

      for (const page of pagesMeta.pages) {
        const textContent = textMap.get(page.id) || '';
        
        // Construct a simple Yoopta content structure with recovered text
        // Note: We lost the rich text structure, so we wrap everything in a single paragraph
        const yooptaContent = {
          [crypto.randomUUID()]: {
            id: crypto.randomUUID(),
            type: 'Paragraph',
            meta: { order: 0, depth: 0 },
            data: {
              text: textContent || '(Content recovered from search index. Rich text formatting lost.)'
            }
          }
        };

        const pageDoc = {
          id: page.id,
          slug: page.slug,
          title: page.title,
          description: page.description,
          tags: page.tags,
          lang: lang,
          status: 'published', // Assume published as it was in public assets
          updatedAt: page.updatedAt || new Date().toISOString(),
          content: yooptaContent,
          render: {
            // We don't have the original render data, but text is most important
            plainText: textContent
          }
        };

        await fs.writeFile(
          path.join(sourceRoot, 'pages', lang, `${page.id}.json`),
          JSON.stringify(pageDoc, null, 2)
        );
        console.log('[%s] Page recovered:', lang, page.slug);
      }
    } catch (e) {
      console.error('[%s] Page recovery failed:', lang, e.message);
    }
  }

  console.log('Recovery completed!');
  console.log("Please run 'pnpm dev' to restart the server and check the recovered project.");
}

main().catch(console.error);
