// =============================================================================
// Plate element-type constants — single source of truth for the strings shared
// between `docContentToPlate` and `plateToDocContent`. Each entry maps a
// DocContentV1 block / inline shape to the Plate-side element `type` string.
//
// The mapping is intentionally a tight, hand-curated table rather than derived
// from DOC_CONTENT_BLOCK_TYPES, because:
//   * Plate's conventional names (`p`, `h1`, `ul`, `code_block`, `hr`) do not
//     mirror DocContentV1's camelCase names (`paragraph`, `codeBlock`).
//   * `list` collapses three DocContent variants into three Plate types
//     (`ul`/`ol`/`todo_list`).
//   * `table` expands into 4 Plate types (`table`/`tr`/`td`/`th`).
// =============================================================================

export const PLATE_PARAGRAPH = 'p';
export const PLATE_HEADING = { 1: 'h1', 2: 'h2', 3: 'h3' } as const;

export const PLATE_LIST_BULLETED = 'ul';
export const PLATE_LIST_NUMBERED = 'ol';
export const PLATE_LIST_TODO = 'todo_list';
export const PLATE_LIST_ITEM = 'li';
export const PLATE_LIST_ITEM_TODO = 'todo_li';

export const PLATE_CODE_BLOCK = 'code_block';
export const PLATE_CODE_GROUP = 'code_group';

export const PLATE_BLOCKQUOTE = 'blockquote';
export const PLATE_CALLOUT = 'callout';

export const PLATE_TABLE = 'table';
export const PLATE_TABLE_ROW = 'tr';
export const PLATE_TABLE_CELL = 'td';
export const PLATE_TABLE_HEADER_CELL = 'th';

export const PLATE_IMAGE = 'img';
export const PLATE_DIVIDER = 'hr';
export const PLATE_MERMAID = 'mermaid';

export const PLATE_LINK = 'a';

// Transient inline node inserted by `@udecode/plate-slash-command` while the
// slash menu is open (holds the `/query` text). It is removed when an item is
// chosen or the input is cancelled, so it NEVER reaches storage — but the
// converter guards against it defensively (see `plateChildrenToInline`).
export const PLATE_SLASH_INPUT = 'slash_input';

// Set used by the inverse converter to detect "is this a list-container
// element type?" without enumerating cases inline.
export const PLATE_LIST_CONTAINER_TYPES = new Set<string>([
  PLATE_LIST_BULLETED,
  PLATE_LIST_NUMBERED,
  PLATE_LIST_TODO,
]);
