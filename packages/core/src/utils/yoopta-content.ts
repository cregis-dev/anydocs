export const DOCS_YOOPTA_ALLOWED_TYPES = [
  'Paragraph',
  'HeadingOne',
  'HeadingTwo',
  'HeadingThree',
  'BulletedList',
  'NumberedList',
  'TodoList',
  'Blockquote',
  'Code',
  'CodeGroup',
  'Divider',
  'Callout',
  'Image',
  'Table',
  'Link',
] as const;

export const DOCS_YOOPTA_ALLOWED_MARKS = [
  'bold',
  'italic',
  'underline',
  'strike',
  'code',
] as const;

export const DOCS_YOOPTA_AUTHORING_GUIDANCE = [
  'Prefer structured Yoopta blocks over empty content objects or markdown-only placeholders.',
  'Use HeadingTwo and HeadingThree to create meaningful section hierarchy for reader TOC extraction.',
  'Mix paragraphs with lists, callouts, code blocks, tables, images, and links when the source material warrants structure.',
  'Reserve HeadingOne for title-like leading content only; the reader already has the page title separately.',
  'Use CodeGroup when presenting the same example in multiple languages or package managers.',
] as const;

type YooptaValidationResult = { ok: true } | { ok: false; error: string };

function isRecord(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

const allowedTypeSet = new Set<string>(DOCS_YOOPTA_ALLOWED_TYPES);

export function validateYooptaContentValue(value: unknown): YooptaValidationResult {
  if (value == null) return { ok: true };
  if (!isRecord(value)) return { ok: false, error: 'content must be an object' };

  for (const [key, raw] of Object.entries(value)) {
    if (!isRecord(raw)) return { ok: false, error: `content.${key} must be an object` };
    const type = raw.type;
    const id = raw.id;
    const blockValue = raw.value;

    if (typeof type !== 'string') return { ok: false, error: `content.${key}.type must be a string` };
    if (!allowedTypeSet.has(type)) return { ok: false, error: `content contains disallowed block type: ${type}` };
    if (typeof id !== 'string') return { ok: false, error: `content.${key}.id must be a string` };
    if (!Array.isArray(blockValue)) return { ok: false, error: `content.${key}.value must be an array` };

    const meta = raw.meta;
    if (meta != null) {
      if (!isRecord(meta)) return { ok: false, error: `content.${key}.meta must be an object` };
      if (typeof meta.order !== 'number') return { ok: false, error: `content.${key}.meta.order must be a number` };
      if (typeof meta.depth !== 'number') return { ok: false, error: `content.${key}.meta.depth must be a number` };
    }
  }

  return { ok: true };
}

export function assertValidYooptaContentValue(value: unknown): void {
  const result = validateYooptaContentValue(value);
  if (result.ok) {
    return;
  }

  throw new Error(result.error);
}
