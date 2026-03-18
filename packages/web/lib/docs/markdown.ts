export type TocItem = {
  depth: number;
  title: string;
  id: string;
};

export function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function getAttributeValue(source: string, name: string) {
  const match = new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i').exec(source);
  return match?.[1]?.trim() ?? '';
}

function collapseWhitespace(value: string) {
  return value.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
}

function quoteBlock(content: string) {
  const lines = content
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return '';
  }

  return lines.map((line) => `> ${line}`).join('\n');
}

function imageTagToMarkdown(tag: string) {
  const src = getAttributeValue(tag, 'src');
  if (!src) {
    return '';
  }

  const alt = getAttributeValue(tag, 'alt').replace(/\]/g, '\\]');
  return `![${alt}](${src})`;
}

function normalizeCardGroups(md: string) {
  return md.replace(/<CardGroup\b[^>]*>([\s\S]*?)<\/CardGroup>/gi, (_group, content: string) => {
    const cards = [...content.matchAll(/<Card\b([^>]*)>([\s\S]*?)<\/Card>/gi)];
    if (cards.length === 0) {
      return '';
    }

    return cards
      .map((match) => {
        const title = getAttributeValue(match[1] ?? '', 'title');
        const body = collapseWhitespace(match[2] ?? '');
        if (!title && !body) {
          return null;
        }

        if (!title) {
          return `- ${body}`;
        }

        return body ? `- **${title}**: ${body}` : `- **${title}**`;
      })
      .filter((value): value is string => Boolean(value))
      .join('\n');
  });
}

function normalizeInfoBlocks(md: string) {
  return md.replace(/<Info>\s*([\s\S]*?)\s*<\/Info>/gi, (_info, content: string) => {
    const quoted = quoteBlock(content);
    return quoted ? `\n${quoted}\n` : '';
  });
}

function normalizeHtmlImages(md: string) {
  return md
    .replace(/<p\b[^>]*>\s*(<img\b[\s\S]*?\/?>)\s*<\/p>/gi, (_paragraph, imageTag: string) => {
      const imageMarkdown = imageTagToMarkdown(imageTag);
      return imageMarkdown ? `\n${imageMarkdown}\n` : '\n';
    })
    .replace(/<img\b[\s\S]*?\/?>/gi, (imageTag) => imageTagToMarkdown(imageTag))
    .replace(/<\/?p\b[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '  \n');
}

export function normalizeMarkdownForRendering(md: string) {
  const normalized = String(md ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ');

  return normalizeHtmlImages(normalizeInfoBlocks(normalizeCardGroups(normalized)))
    .replace(/<\/?[A-Z][A-Za-z0-9-]*\b[^>]*>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function extractTocFromMarkdown(md: string): TocItem[] {
  const items: TocItem[] = [];
  const lines = String(md ?? '').split(/\r?\n/);
  for (const line of lines) {
    const m = /^(#{2,4})\s+(.+?)\s*$/.exec(line);
    if (!m) continue;
    const depth = m[1].length;
    const title = m[2].replace(/`/g, '').trim();
    const id = slugify(title);
    items.push({ depth, title, id });
  }
  return items;
}

export function injectHeadingIds(md: string) {
  const lines = String(md ?? '').split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const m = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (!m) {
      out.push(line);
      continue;
    }
    const hashes = m[1];
    const title = m[2].trim();
    const id = slugify(title.replace(/`/g, '').trim());
    out.push(`${hashes} <a id="${id}"></a>${title}`);
  }
  return out.join('\n');
}
