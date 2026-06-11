// =============================================================================
// Slash command menu
// -----------------------------------------------------------------------------
// Notion-style block-insert menu: typing `/` at the start of an empty
// paragraph opens a floating menu listing the canonical block types; further
// typing filters it, Arrow keys navigate, Enter/Tab applies, Escape closes.
// Applying an item REPLACES the trigger paragraph (which at that point
// contains only `/` + the query text) with a fresh node of the chosen type.
//
// Implementation notes:
//   * Zero new dependencies. `@udecode/plate-slash-command`'s combobox
//     pipeline drags in the cmdk-based InlineCombobox UI stack; this menu
//     only needs trigger detection + a filtered list, which a capture-phase
//     keydown listener on the contenteditable covers.
//   * The component lives INSIDE the <Plate> tree (sibling of PlateContent)
//     so `useEditorRef()` resolves the editor from context. The dropdown
//     itself renders through a portal to <body> — interactive UI inside the
//     contenteditable would fight Slate for DOM ownership.
//   * Inline styles, not Tailwind classes — the menu must not depend on the
//     host piping Tailwind into the editor.
//   * Pure `.ts` (React.createElement) like the rest of the runtime.
//
// Node shapes below MUST stay in sync with the builtin plugin converters
// (see src/plugins/builtin/*.ts) — `createNode()` output feeds straight into
// `editor.tf.insertNodes` and later round-trips through `plateToDocContent`.
// =============================================================================

import * as React from 'react';
import { createPortal } from 'react-dom';

import { useEditorRef } from '@udecode/plate/react';

import {
  PLATE_BLOCKQUOTE,
  PLATE_CALLOUT,
  PLATE_CODE_BLOCK,
  PLATE_DIVIDER,
  PLATE_HEADING,
  PLATE_IMAGE,
  PLATE_LIST_BULLETED,
  PLATE_LIST_ITEM,
  PLATE_LIST_ITEM_TODO,
  PLATE_LIST_NUMBERED,
  PLATE_LIST_TODO,
  PLATE_MERMAID,
  PLATE_PARAGRAPH,
  PLATE_TABLE,
  PLATE_TABLE_CELL,
  PLATE_TABLE_HEADER_CELL,
  PLATE_TABLE_ROW,
} from '../converters/element-types.ts';

// -----------------------------------------------------------------------------
// Item catalogue
// -----------------------------------------------------------------------------

export type SlashMenuItem = {
  key: string;
  label: string;
  description: string;
  /** Extra match terms beyond label (lower-case). */
  keywords: string[];
  /** Builds the Plate node that replaces the trigger paragraph. */
  createNode: () => Record<string, unknown>;
};

function emptyText(): Array<{ text: string }> {
  return [{ text: '' }];
}

export const SLASH_MENU_ITEMS: ReadonlyArray<SlashMenuItem> = [
  {
    key: 'h1',
    label: 'Heading 1',
    description: 'Top-level section heading',
    keywords: ['h1', 'heading', 'title', '标题'],
    createNode: () => ({ type: PLATE_HEADING[1], children: emptyText() }),
  },
  {
    key: 'h2',
    label: 'Heading 2',
    description: 'Section heading',
    keywords: ['h2', 'heading', '标题'],
    createNode: () => ({ type: PLATE_HEADING[2], children: emptyText() }),
  },
  {
    key: 'h3',
    label: 'Heading 3',
    description: 'Subsection heading',
    keywords: ['h3', 'heading', '标题'],
    createNode: () => ({ type: PLATE_HEADING[3], children: emptyText() }),
  },
  {
    key: 'bulleted-list',
    label: 'Bulleted list',
    description: 'Unordered list',
    keywords: ['ul', 'list', 'bullet', 'unordered', '列表'],
    createNode: () => ({
      type: PLATE_LIST_BULLETED,
      children: [{ type: PLATE_LIST_ITEM, children: emptyText() }],
    }),
  },
  {
    key: 'numbered-list',
    label: 'Numbered list',
    description: 'Ordered list',
    keywords: ['ol', 'list', 'number', 'ordered', '列表'],
    createNode: () => ({
      type: PLATE_LIST_NUMBERED,
      children: [{ type: PLATE_LIST_ITEM, children: emptyText() }],
    }),
  },
  {
    key: 'todo-list',
    label: 'To-do list',
    description: 'List with checkboxes',
    keywords: ['todo', 'task', 'check', 'checkbox', '待办'],
    createNode: () => ({
      type: PLATE_LIST_TODO,
      children: [{ type: PLATE_LIST_ITEM_TODO, checked: false, children: emptyText() }],
    }),
  },
  {
    key: 'code-block',
    label: 'Code block',
    description: 'Monospace code snippet',
    keywords: ['code', 'snippet', 'pre', '代码'],
    createNode: () => ({ type: PLATE_CODE_BLOCK, children: emptyText() }),
  },
  {
    key: 'blockquote',
    label: 'Quote',
    description: 'Block quotation',
    keywords: ['quote', 'blockquote', 'cite', '引用'],
    createNode: () => ({ type: PLATE_BLOCKQUOTE, children: emptyText() }),
  },
  {
    key: 'callout',
    label: 'Callout',
    description: 'Highlighted note box',
    keywords: ['callout', 'note', 'info', 'warning', '提示'],
    createNode: () => ({ type: PLATE_CALLOUT, tone: 'info', children: emptyText() }),
  },
  {
    key: 'table',
    label: 'Table',
    description: '2×2 table with a header row',
    keywords: ['table', 'grid', '表格'],
    createNode: () => ({
      type: PLATE_TABLE,
      children: [
        {
          type: PLATE_TABLE_ROW,
          children: [
            { type: PLATE_TABLE_HEADER_CELL, children: emptyText() },
            { type: PLATE_TABLE_HEADER_CELL, children: emptyText() },
          ],
        },
        {
          type: PLATE_TABLE_ROW,
          children: [
            { type: PLATE_TABLE_CELL, children: emptyText() },
            { type: PLATE_TABLE_CELL, children: emptyText() },
          ],
        },
      ],
    }),
  },
  {
    key: 'image',
    label: 'Image',
    description: 'Image block (set src in page JSON or paste a URL)',
    keywords: ['image', 'img', 'picture', 'photo', '图片'],
    createNode: () => ({ type: PLATE_IMAGE, src: '', children: emptyText() }),
  },
  {
    key: 'divider',
    label: 'Divider',
    description: 'Horizontal rule',
    keywords: ['divider', 'hr', 'rule', 'separator', '分隔'],
    createNode: () => ({ type: PLATE_DIVIDER, children: emptyText() }),
  },
  {
    key: 'mermaid',
    label: 'Mermaid diagram',
    description: 'Diagram-as-code block',
    keywords: ['mermaid', 'diagram', 'flowchart', 'chart', '图表'],
    createNode: () => ({
      type: PLATE_MERMAID,
      code: 'flowchart TD\n  A --> B',
      children: emptyText(),
    }),
  },
];

/** Case-insensitive filter over label + keywords. Exported for tests. */
export function filterSlashItems(query: string): SlashMenuItem[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [...SLASH_MENU_ITEMS];
  return SLASH_MENU_ITEMS.filter(
    (item) =>
      item.label.toLowerCase().includes(q) ||
      item.keywords.some((k) => k.includes(q)),
  );
}

// -----------------------------------------------------------------------------
// Editor transform
// -----------------------------------------------------------------------------

// Structural minimum of the Plate editor surface the menu touches.
type SlashEditor = {
  children: Array<{ type?: string; children?: Array<{ text?: string }> }>;
  selection?: unknown;
  api: {
    start: (at: number[]) => unknown;
    toDOMNode: (node: unknown) => HTMLElement | undefined;
  };
  tf: {
    removeNodes: (opts: { at: number[] }) => void;
    insertNodes: (node: unknown, opts: { at: number[] }) => void;
    select: (at: unknown) => void;
    focus: () => void;
  };
};

/**
 * Replaces the block at `blockIndex` (the trigger paragraph holding the
 * `/query` text) with the item's node and places the caret at its start.
 * Exported for tests — drives the same `editor.tf` pipeline as the UI.
 */
export function applySlashItem(editorLike: unknown, blockIndex: number, item: SlashMenuItem): void {
  const editor = editorLike as SlashEditor;
  editor.tf.removeNodes({ at: [blockIndex] });
  editor.tf.insertNodes(item.createNode(), { at: [blockIndex] });
  try {
    // Pure model-state op — safe even when the editor isn't mounted.
    editor.tf.select(editor.api.start([blockIndex]));
  } catch {
    // Selection placement is best-effort — exotic void-only nodes may
    // reject it; the block replacement itself stands.
  }
  // `tf.focus()` resolves DOM nodes (and retries ASYNCHRONOUSLY in
  // slate-react), so it must only run when the editor is actually mounted —
  // otherwise it throws after the caller's turn ends (visible as async
  // noise in tests). Probe for a DOM node first.
  try {
    const editable = editor.api.toDOMNode(editor as unknown as object);
    if (editable) editor.tf.focus();
  } catch {
    // Unmounted — skip focus.
  }
}

// -----------------------------------------------------------------------------
// Trigger detection helpers
// -----------------------------------------------------------------------------

type SlateRangePoint = { path: number[]; offset: number };
type SlateRange = { anchor: SlateRangePoint; focus: SlateRangePoint };

// Block types whose children are plain inline content — `/` in an EMPTY one
// of these opens the menu. Structural blocks (lists, tables, code) own their
// children's semantics, so the trigger stays off there.
const SLASH_TRIGGER_TYPES = new Set<string>([
  PLATE_PARAGRAPH,
  PLATE_HEADING[1],
  PLATE_HEADING[2],
  PLATE_HEADING[3],
  PLATE_BLOCKQUOTE,
  PLATE_CALLOUT,
]);

function isCollapsed(range: SlateRange): boolean {
  return (
    range.anchor.offset === range.focus.offset &&
    range.anchor.path.length === range.focus.path.length &&
    range.anchor.path.every((seg, i) => seg === range.focus.path[i])
  );
}

function blockText(editor: SlashEditor, blockIndex: number): string | null {
  const block = editor.children[blockIndex];
  if (!block || !Array.isArray(block.children)) return null;
  let out = '';
  for (const child of block.children) {
    if (typeof child.text === 'string') out += child.text;
    else return null; // non-text child (inline element) — not a trigger block
  }
  return out;
}

// -----------------------------------------------------------------------------
// Menu component
// -----------------------------------------------------------------------------

type MenuState = {
  blockIndex: number;
  query: string;
  highlighted: number;
  // Viewport coordinates of the caret when the menu opened (position: fixed).
  left: number;
  top: number;
};

const MENU_STYLE: React.CSSProperties = {
  position: 'fixed',
  zIndex: 1000,
  minWidth: 240,
  maxWidth: 320,
  maxHeight: 320,
  overflowY: 'auto',
  background: '#ffffff',
  color: '#18181b',
  border: '1px solid #e4e4e7',
  borderRadius: 8,
  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
  padding: 4,
  fontSize: 14,
  lineHeight: 1.4,
};

const ITEM_STYLE: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '6px 10px',
  borderRadius: 6,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  font: 'inherit',
  color: 'inherit',
};

function caretViewportPosition(editor: SlashEditor, blockIndex: number): { left: number; top: number } {
  const selection = typeof window !== 'undefined' ? window.getSelection() : null;
  if (selection && selection.rangeCount > 0) {
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (rect && (rect.left !== 0 || rect.bottom !== 0)) {
      return { left: rect.left, top: rect.bottom + 4 };
    }
  }
  // Empty text nodes can report a zero rect — fall back to the block element.
  try {
    const blockEl = editor.api.toDOMNode(editor.children[blockIndex]);
    if (blockEl) {
      const rect = blockEl.getBoundingClientRect();
      return { left: rect.left, top: rect.bottom + 4 };
    }
  } catch {
    // fall through to a safe default
  }
  return { left: 16, top: 16 };
}

/**
 * Mounted as a sibling of `<PlateContent>` inside the `<Plate>` tree (see
 * plate-runtime.ts). Owns the slash-menu lifecycle via a capture-phase
 * keydown listener on the contenteditable.
 */
export function SlashMenuController(): React.ReactElement | null {
  const editor = useEditorRef() as unknown as SlashEditor;
  const [menu, setMenu] = React.useState<MenuState | null>(null);
  const menuRef = React.useRef<MenuState | null>(null);
  menuRef.current = menu;
  const listRef = React.useRef<HTMLDivElement | null>(null);
  // Hidden sibling of <PlateContent> — used to locate the contenteditable
  // via the DOM. `editor.api.toDOMNode(editor)` returns undefined for the
  // editor root in Plate v49, so DOM-relative lookup is the reliable path,
  // and it stays correct with multiple editor instances on one page.
  const anchorRef = React.useRef<HTMLSpanElement | null>(null);

  React.useEffect(() => {
    const container = anchorRef.current?.parentElement;
    const editable = container?.querySelector<HTMLElement>('[data-slate-editor="true"]') ?? undefined;
    if (!editable) return;

    function syncQueryAfterInput(): void {
      // Runs after Slate has applied the keystroke.
      setTimeout(() => {
        const state = menuRef.current;
        if (state === null) return;
        const text = blockText(editor, state.blockIndex);
        if (text === null || !text.startsWith('/')) {
          setMenu(null);
          return;
        }
        const query = text.slice(1);
        if (filterSlashItems(query).length === 0 && query.length > 0) {
          setMenu(null);
          return;
        }
        setMenu({ ...state, query, highlighted: 0 });
      }, 0);
    }

    function onKeyDown(event: KeyboardEvent): void {
      const state = menuRef.current;

      if (state === null) {
        if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
        const selection = editor.selection as SlateRange | null | undefined;
        if (!selection || !isCollapsed(selection)) return;
        const blockIndex = selection.anchor.path[0];
        if (blockIndex === undefined) return;
        const block = editor.children[blockIndex];
        // Trigger from ANY empty text-container block, not just paragraphs —
        // pressing Enter at the end of a heading leaves the new block as a
        // heading (no exit-break yet at that instant), and Notion-style UX
        // expects `/` to work there too.
        if (!block || typeof block.type !== 'string' || !SLASH_TRIGGER_TYPES.has(block.type)) return;
        if (blockText(editor, blockIndex) !== '') return;
        // Let the `/` character insert normally, then open the menu.
        setTimeout(() => {
          const pos = caretViewportPosition(editor, blockIndex);
          setMenu({ blockIndex, query: '', highlighted: 0, ...pos });
        }, 0);
        return;
      }

      // Menu is open — intercept navigation keys before Slate sees them.
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        const items = filterSlashItems(state.query);
        if (items.length === 0) return;
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        const next = (state.highlighted + delta + items.length) % items.length;
        setMenu({ ...state, highlighted: next });
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        event.stopPropagation();
        const items = filterSlashItems(state.query);
        const item = items[state.highlighted] ?? items[0];
        setMenu(null);
        if (item) applySlashItem(editor, state.blockIndex, item);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setMenu(null);
        return;
      }
      // Anything else (typing, backspace, arrows we don't own) updates the
      // query once Slate has processed it.
      syncQueryAfterInput();
    }

    function onMouseDown(): void {
      // Clicking elsewhere in the document closes the menu (item buttons
      // call preventDefault on mousedown before this runs — see below —
      // so applying an item still works).
      if (menuRef.current !== null) setMenu(null);
    }

    editable.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      editable.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('mousedown', onMouseDown);
    };
    // The editor instance is stable for the lifetime of this tree (key-bump
    // remounts build a fresh tree), so mount-once wiring is correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the highlighted row visible while arrowing through a long list.
  React.useEffect(() => {
    if (menu === null || listRef.current === null) return;
    const el = listRef.current.querySelector(`[data-slash-index="${menu.highlighted}"]`);
    // jsdom doesn't implement scrollIntoView — an unguarded call here threw
    // inside the effect and unmounted the whole controller (incl. the menu).
    if (el && typeof (el as HTMLElement).scrollIntoView === 'function') {
      (el as HTMLElement).scrollIntoView({ block: 'nearest' });
    }
  }, [menu]);

  // The hidden anchor must render unconditionally — the mount effect uses it
  // to locate the contenteditable sibling.
  const anchor = React.createElement('span', {
    key: 'anchor',
    ref: anchorRef,
    style: { display: 'none' },
    'data-anydocs-slash-anchor': 'true',
  });

  if (menu === null || typeof document === 'undefined') {
    return anchor;
  }

  const items = filterSlashItems(menu.query);

  const menuNode = React.createElement(
    'div',
    {
      ref: listRef,
      role: 'listbox',
      'aria-label': 'Insert block',
      'data-anydocs-slash-menu': 'true',
      style: { ...MENU_STYLE, left: menu.left, top: menu.top },
    },
    items.map((item, index) =>
      React.createElement(
        'button',
        {
          key: item.key,
          type: 'button',
          role: 'option',
          'aria-selected': index === menu.highlighted,
          'data-slash-index': index,
          style: {
            ...ITEM_STYLE,
            background: index === menu.highlighted ? '#f4f4f5' : 'transparent',
          },
          // preventDefault keeps focus + selection in the editor so the
          // block replacement targets the right path.
          onMouseDown: (event: React.MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
            setMenu(null);
            applySlashItem(editor, menu.blockIndex, item);
          },
          onMouseEnter: () => setMenu({ ...menu, highlighted: index }),
        },
        React.createElement('div', { style: { fontWeight: 500 } }, item.label),
        React.createElement(
          'div',
          { style: { fontSize: 12, color: '#71717a' } },
          item.description,
        ),
      ),
    ),
  );

  return React.createElement(
    React.Fragment,
    null,
    anchor,
    createPortal(menuNode, document.body),
  );
}
