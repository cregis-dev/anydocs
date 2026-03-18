import type { YooptaContentValue } from '@yoopta/editor';

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

const allowedTypeSet = new Set<string>(DOCS_YOOPTA_ALLOWED_TYPES);

function isRecord(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

export function validateYooptaContentValue(value: unknown): { ok: true } | { ok: false; error: string } {
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

export function assertValidYooptaContentValue(value: unknown): asserts value is YooptaContentValue {
  const r = validateYooptaContentValue(value);
  if (!r.ok) throw new Error(r.error);
}

