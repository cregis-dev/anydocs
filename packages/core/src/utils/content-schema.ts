import {
  DOC_CONTENT_BLOCK_TYPES,
  DOC_CONTENT_CALLOUT_TONES,
  DOC_CONTENT_TEXT_MARKS,
  DOC_CONTENT_VERSION,
  type CalloutTone,
  type DocContentV1,
  type TextMark,
} from '../types/content.ts';

export type DocContentValidationResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      path: string;
    };

const TEXT_MARK_SET = new Set<TextMark>(DOC_CONTENT_TEXT_MARKS);
const CALLOUT_TONE_SET = new Set<CalloutTone>(DOC_CONTENT_CALLOUT_TONES);

function ok(): DocContentValidationResult {
  return { ok: true };
}

function fail(path: string, error: string): DocContentValidationResult {
  return { ok: false, path, error };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function validateOptionalId(value: unknown, path: string): DocContentValidationResult {
  if (value == null) {
    return ok();
  }

  return typeof value === 'string' ? ok() : fail(path, 'must be a string when present');
}

function validateTextNode(value: unknown, path: string): DocContentValidationResult {
  if (!isRecord(value)) return fail(path, 'must be an object');
  if (value.type !== 'text') return fail(`${path}.type`, 'must equal "text"');
  if (typeof value.text !== 'string') return fail(`${path}.text`, 'must be a string');

  if (value.marks != null) {
    if (!Array.isArray(value.marks)) return fail(`${path}.marks`, 'must be an array when present');

    for (let i = 0; i < value.marks.length; i += 1) {
      const mark = value.marks[i];
      if (typeof mark !== 'string' || !TEXT_MARK_SET.has(mark as TextMark)) {
        return fail(`${path}.marks[${i}]`, `must be one of: ${DOC_CONTENT_TEXT_MARKS.join(', ')}`);
      }
    }
  }

  return ok();
}

function validateLinkNode(value: unknown, path: string): DocContentValidationResult {
  if (!isRecord(value)) return fail(path, 'must be an object');
  if (value.type !== 'link') return fail(`${path}.type`, 'must equal "link"');
  if (!isNonEmptyString(value.href)) return fail(`${path}.href`, 'must be a non-empty string');
  if (value.title != null && typeof value.title !== 'string') {
    return fail(`${path}.title`, 'must be a string when present');
  }
  if (!Array.isArray(value.children)) return fail(`${path}.children`, 'must be an array');

  for (let i = 0; i < value.children.length; i += 1) {
    const result = validateTextNode(value.children[i], `${path}.children[${i}]`);
    if (!result.ok) return result;
  }

  return ok();
}

function validateInlineNode(value: unknown, path: string): DocContentValidationResult {
  if (!isRecord(value)) return fail(path, 'must be an object');
  if (value.type === 'text') return validateTextNode(value, path);
  if (value.type === 'link') return validateLinkNode(value, path);
  return fail(`${path}.type`, 'must equal "text" or "link"');
}

function validateInlineChildren(value: unknown, path: string): DocContentValidationResult {
  if (!Array.isArray(value)) return fail(path, 'must be an array');

  for (let i = 0; i < value.length; i += 1) {
    const result = validateInlineNode(value[i], `${path}[${i}]`);
    if (!result.ok) return result;
  }

  return ok();
}

function validateListItem(value: unknown, path: string, style: unknown): DocContentValidationResult {
  if (!isRecord(value)) return fail(path, 'must be an object');

  const idResult = validateOptionalId(value.id, `${path}.id`);
  if (!idResult.ok) return idResult;

  const childrenResult = validateInlineChildren(value.children, `${path}.children`);
  if (!childrenResult.ok) return childrenResult;

  if (style === 'todo' && value.checked != null && typeof value.checked !== 'boolean') {
    return fail(`${path}.checked`, 'must be a boolean for todo lists');
  }

  if (style !== 'todo' && value.checked != null) {
    return fail(`${path}.checked`, 'is only allowed for todo lists');
  }

  if (value.items != null) {
    if (!Array.isArray(value.items)) return fail(`${path}.items`, 'must be an array when present');

    for (let i = 0; i < value.items.length; i += 1) {
      const result = validateListItem(value.items[i], `${path}.items[${i}]`, style);
      if (!result.ok) return result;
    }
  }

  return ok();
}

function validateTableRow(value: unknown, path: string): DocContentValidationResult {
  if (!isRecord(value)) return fail(path, 'must be an object');

  const rowIdResult = validateOptionalId(value.id, `${path}.id`);
  if (!rowIdResult.ok) return rowIdResult;

  if (!Array.isArray(value.cells)) return fail(`${path}.cells`, 'must be an array');

  for (let i = 0; i < value.cells.length; i += 1) {
    const cell = value.cells[i];
    if (!isRecord(cell)) return fail(`${path}.cells[${i}]`, 'must be an object');

    const cellIdResult = validateOptionalId(cell.id, `${path}.cells[${i}].id`);
    if (!cellIdResult.ok) return cellIdResult;

    if (cell.header != null && typeof cell.header !== 'boolean') {
      return fail(`${path}.cells[${i}].header`, 'must be a boolean when present');
    }

    const childrenResult = validateInlineChildren(cell.children, `${path}.cells[${i}].children`);
    if (!childrenResult.ok) return childrenResult;
  }

  return ok();
}

function validateBlock(value: unknown, path: string): DocContentValidationResult {
  if (!isRecord(value)) return fail(path, 'must be an object');
  if (!isNonEmptyString(value.type)) return fail(`${path}.type`, 'must be a non-empty string');

  const idResult = validateOptionalId(value.id, `${path}.id`);
  if (!idResult.ok) return idResult;

  switch (value.type) {
    case 'paragraph':
    case 'blockquote':
      return validateInlineChildren(value.children, `${path}.children`);
    case 'heading':
      if (value.level !== 1 && value.level !== 2 && value.level !== 3) {
        return fail(`${path}.level`, 'must be 1, 2, or 3');
      }
      return validateInlineChildren(value.children, `${path}.children`);
    case 'list':
      if (value.style !== 'bulleted' && value.style !== 'numbered' && value.style !== 'todo') {
        return fail(`${path}.style`, 'must be "bulleted", "numbered", or "todo"');
      }
      if (!Array.isArray(value.items)) return fail(`${path}.items`, 'must be an array');

      for (let i = 0; i < value.items.length; i += 1) {
        const result = validateListItem(value.items[i], `${path}.items[${i}]`, value.style);
        if (!result.ok) return result;
      }

      return ok();
    case 'codeBlock':
      if (value.language != null && typeof value.language !== 'string') {
        return fail(`${path}.language`, 'must be a string when present');
      }
      if (value.title != null && typeof value.title !== 'string') {
        return fail(`${path}.title`, 'must be a string when present');
      }
      return typeof value.code === 'string' && value.code.trim().length > 0
        ? ok()
        : fail(`${path}.code`, 'must be a non-empty string');
    case 'codeGroup':
      if (!Array.isArray(value.items)) return fail(`${path}.items`, 'must be an array');
      if (value.items.length === 0) return fail(`${path}.items`, 'must have at least one item');

      for (let i = 0; i < value.items.length; i += 1) {
        const item = value.items[i];
        if (!isRecord(item)) return fail(`${path}.items[${i}]`, 'must be an object');

        const itemIdResult = validateOptionalId(item.id, `${path}.items[${i}].id`);
        if (!itemIdResult.ok) return itemIdResult;
        if (item.language != null && typeof item.language !== 'string') {
          return fail(`${path}.items[${i}].language`, 'must be a string when present');
        }
        if (item.title != null && typeof item.title !== 'string') {
          return fail(`${path}.items[${i}].title`, 'must be a string when present');
        }
        if (typeof item.code !== 'string' || item.code.trim().length === 0) {
          return fail(`${path}.items[${i}].code`, 'must be a non-empty string');
        }
      }

      return ok();
    case 'callout':
      if (value.tone != null && (typeof value.tone !== 'string' || !CALLOUT_TONE_SET.has(value.tone as CalloutTone))) {
        return fail(`${path}.tone`, `must be one of: ${DOC_CONTENT_CALLOUT_TONES.join(', ')}`);
      }
      if (value.title != null && typeof value.title !== 'string') {
        return fail(`${path}.title`, 'must be a string when present');
      }
      return validateInlineChildren(value.children, `${path}.children`);
    case 'table':
      if (!Array.isArray(value.rows)) return fail(`${path}.rows`, 'must be an array');

      for (let i = 0; i < value.rows.length; i += 1) {
        const result = validateTableRow(value.rows[i], `${path}.rows[${i}]`);
        if (!result.ok) return result;
      }

      return ok();
    case 'image':
      if (!isNonEmptyString(value.src)) return fail(`${path}.src`, 'must be a non-empty string');
      if (value.alt != null && typeof value.alt !== 'string') return fail(`${path}.alt`, 'must be a string when present');
      if (value.title != null && typeof value.title !== 'string') return fail(`${path}.title`, 'must be a string when present');
      if (value.width != null && (typeof value.width !== 'number' || !Number.isInteger(value.width) || value.width <= 0)) {
        return fail(`${path}.width`, 'must be a positive integer when present');
      }
      if (value.height != null && (typeof value.height !== 'number' || !Number.isInteger(value.height) || value.height <= 0)) {
        return fail(`${path}.height`, 'must be a positive integer when present');
      }
      if (value.caption != null) {
        const captionResult = validateInlineChildren(value.caption, `${path}.caption`);
        if (!captionResult.ok) return captionResult;
      }
      return ok();
    case 'divider':
      return ok();
    case 'mermaid':
      if (value.title != null && typeof value.title !== 'string') {
        return fail(`${path}.title`, 'must be a string when present');
      }
      return typeof value.code === 'string' ? ok() : fail(`${path}.code`, 'must be a string');
    default:
      return fail(
        `${path}.type`,
        `unsupported block type "${String(value.type)}"; expected one of: ${DOC_CONTENT_BLOCK_TYPES.join(', ')}`,
      );
  }
}

export function validateDocContentV1(value: unknown): DocContentValidationResult {
  if (!isRecord(value)) return fail('content', 'must be an object');
  if (value.version !== DOC_CONTENT_VERSION) return fail('content.version', `must equal ${DOC_CONTENT_VERSION}`);
  if (!Array.isArray(value.blocks)) return fail('content.blocks', 'must be an array');

  for (let i = 0; i < value.blocks.length; i += 1) {
    const result = validateBlock(value.blocks[i], `content.blocks[${i}]`);
    if (!result.ok) return result;
  }

  return ok();
}

export function assertValidDocContentV1(value: unknown): asserts value is DocContentV1 {
  const result = validateDocContentV1(value);
  if (result.ok) {
    return;
  }

  throw new Error(`${result.path}: ${result.error}`);
}
