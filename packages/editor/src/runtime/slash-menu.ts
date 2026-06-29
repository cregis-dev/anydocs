// =============================================================================
// Slash command menu
// -----------------------------------------------------------------------------
// Notion-style block-insert menu: typing `/` at the start of an empty block
// opens a floating menu listing the canonical block types; further typing
// filters it, Arrow keys navigate, Enter/Tab/click applies, Escape closes.
//
// Implementation (Story: official-slash):
//   * Trigger + state are owned by `@udecode/plate-slash-command`'s
//     `SlashPlugin`. Typing `/` inserts a transient inline `slash_input`
//     node (Plate's `withTriggerCombobox`); the node's text is the query.
//     This routes through Slate's normal input pipeline — IME-safe, robust,
//     no capture-phase keydown hacks.
//   * The dropdown is `@ariakit/react`'s combobox (the same primitive Plate's
//     own registry uses), anchored to the inline `slash_input` node so it
//     tracks the caret and follows scrollable containers automatically.
//   * Styling is INLINE (plus one scoped <style> for the active-item/hover
//     states, which attribute selectors can't express inline) — the menu
//     must not depend on the host piping Tailwind into the editor, matching
//     slash-menu's long-standing constraint.
//   * Pure `.ts` (React.createElement) like the rest of the runtime.
//
// Node shapes in SLASH_MENU_ITEMS MUST stay in sync with the builtin plugin
// converters (see src/plugins/builtin/*.ts) — `createNode()` output feeds
// straight into `editor.tf.insertNodes` and later round-trips through
// `plateToDocContent`.
// =============================================================================

import * as React from 'react';

import type { Point, TElement } from '@udecode/plate';
import {
  Combobox,
  ComboboxItem,
  type ComboboxItemProps,
  ComboboxPopover,
  ComboboxProvider,
  Portal,
  useComboboxContext,
  useComboboxStore,
} from '@ariakit/react';
import {
  type UseComboboxInputResult,
  useComboboxInput,
  useHTMLInputCursorState,
} from '@udecode/plate-combobox/react';
import {
  PlateElement,
  type PlateElementProps,
  useComposedRef,
  useEditorRef,
} from '@udecode/plate/react';
import { SlashPlugin } from '@udecode/plate-slash-command/react';

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
  /** Builds the Plate node that replaces the trigger block. */
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

// Structural minimum of the Plate editor surface the transforms touch.
type SlashNode = { type?: string; text?: string; children?: SlashNode[] };
type SlashEditor = {
  children: SlashNode[];
  selection?: { anchor: { path: number[]; offset: number } } | null;
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

/** Places the caret at the start of the block at `blockIndex` and refocuses. */
function finishApply(editor: SlashEditor, blockIndex: number): void {
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

/**
 * Resolves the lowest element block containing the caret: its path (without the
 * trailing text-leaf index) and node. Returns null when there is no collapsed
 * selection inside an element. Used to gate the trigger and to decide how an
 * item applies (top-level block vs. nested list item).
 */
function leafBlockEntry(editorLike: unknown): { path: number[]; node: SlashNode } | null {
  const editor = editorLike as SlashEditor;
  const anchorPath = editor.selection?.anchor.path;
  if (!Array.isArray(anchorPath) || anchorPath.length === 0) return null;
  const blockPath = anchorPath.slice(0, -1);
  if (blockPath.length === 0) return null;
  let nodes: SlashNode[] | undefined = editor.children;
  let node: SlashNode | undefined;
  for (const idx of blockPath) {
    if (!nodes) return null;
    node = nodes[idx];
    if (!node) return null;
    nodes = node.children;
  }
  if (!node || typeof node.type !== 'string' || !Array.isArray(node.children)) return null;
  return { path: blockPath, node };
}

/** A block is empty when its children are text leaves that concatenate to ''. */
function isEmptyBlock(node: SlashNode): boolean {
  if (!Array.isArray(node.children)) return false;
  let text = '';
  for (const child of node.children) {
    if (typeof child.text === 'string') text += child.text;
    else return false; // a non-text child (inline element) ⇒ not empty
  }
  return text === '';
}

/**
 * Replaces the block at `blockIndex` (the trigger block, which at apply time
 * is the empty block the `slash_input` node lived in) with the item's node and
 * places the caret at its start. Exported for tests — drives the same
 * `editor.tf` pipeline as the UI.
 */
export function applySlashItem(editorLike: unknown, blockIndex: number, item: SlashMenuItem): void {
  const editor = editorLike as SlashEditor;
  editor.tf.removeNodes({ at: [blockIndex] });
  editor.tf.insertNodes(item.createNode(), { at: [blockIndex] });
  finishApply(editor, blockIndex);
}

/**
 * Applies an item from inside an empty list item: lifts the chosen block OUT of
 * the list rather than nesting it. If the list holds only this (empty) item the
 * whole list is replaced; otherwise the empty item is removed and the new block
 * is inserted right after the list. `itemPath` is the path to the list item.
 */
function applySlashItemFromListItem(editor: SlashEditor, itemPath: number[], item: SlashMenuItem): void {
  const listIndex = itemPath[0];
  const list = editor.children[listIndex];
  const itemCount = Array.isArray(list?.children) ? list.children.length : 0;
  if (itemCount <= 1) {
    // The list holds only this empty item — replace the whole list.
    applySlashItem(editor, listIndex, item);
    return;
  }
  const insertAt = listIndex + 1;
  editor.tf.removeNodes({ at: itemPath });
  editor.tf.insertNodes(item.createNode(), { at: [insertAt] });
  finishApply(editor, insertAt);
}

/**
 * Applies an item at the current selection. Used by the UI: after the combobox
 * removes the `slash_input` node it restores the caret into the (now empty)
 * host block. A top-level text block is replaced in place; an empty list item
 * lifts the new block out of the list (see {@link applySlashItemFromListItem}).
 */
export function applySlashItemAtSelection(editorLike: unknown, item: SlashMenuItem): void {
  const editor = editorLike as SlashEditor;
  const entry = leafBlockEntry(editor);
  if (!entry) {
    const blockIndex = editor.selection?.anchor.path[0];
    if (typeof blockIndex === 'number') applySlashItem(editor, blockIndex, item);
    return;
  }
  if (entry.path.length === 1) {
    applySlashItem(editor, entry.path[0], item);
    return;
  }
  applySlashItemFromListItem(editor, entry.path, item);
}

// -----------------------------------------------------------------------------
// Trigger gating
// -----------------------------------------------------------------------------

// Block types whose children are plain inline content — `/` in an EMPTY one of
// these opens the menu. Plain text blocks are replaced in place; empty list
// items lift the chosen block out of the list. Other structural blocks (tables,
// code) own their children's semantics, so the trigger stays off there.
const SLASH_TRIGGER_TYPES = new Set<string>([
  PLATE_PARAGRAPH,
  PLATE_HEADING[1],
  PLATE_HEADING[2],
  PLATE_HEADING[3],
  PLATE_BLOCKQUOTE,
  PLATE_CALLOUT,
  PLATE_LIST_ITEM,
  PLATE_LIST_ITEM_TODO,
]);

/**
 * `/` only opens the menu inside an empty, whitelisted block (including empty
 * list items). Runs at the instant `/` is typed (before the char is inserted),
 * so the block text is still empty for a fresh block.
 */
export function isEmptyTriggerBlock(editorLike: unknown): boolean {
  const entry = leafBlockEntry(editorLike);
  if (!entry || typeof entry.node.type !== 'string') return false;
  return SLASH_TRIGGER_TYPES.has(entry.node.type) && isEmptyBlock(entry.node);
}

/**
 * The configured slash plugin registered by the runtime. `SlashPlugin` already
 * bundles `SlashInputPlugin` (the `slash_input` node), so registering this one
 * plugin wires up both the trigger behaviour and the node type. The
 * `slash_input` render component is supplied separately via `override.components`
 * (see element-components.ts → `SlashInputElement`).
 */
export const SlashCommandPlugin = SlashPlugin.configure({
  options: {
    triggerQuery: (editor: unknown) => isEmptyTriggerBlock(editor),
  },
});

// -----------------------------------------------------------------------------
// Dropdown UI — @ariakit/react combobox, inline-styled
// -----------------------------------------------------------------------------

const POPOVER_STYLE: React.CSSProperties = {
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
  cursor: 'pointer',
  outline: 'none',
};

const EMPTY_STYLE: React.CSSProperties = {
  padding: '6px 10px',
  color: '#71717a',
  fontSize: 13,
};

// Active-item / hover backgrounds depend on attribute + pseudo selectors that
// inline styles cannot express, so a single scoped rule set is injected once.
const STYLE_TAG_ID = 'anydocs-slash-menu-styles';
const STYLE_RULES = [
  '[data-anydocs-slash-menu] [data-slash-item]:hover{background:#f4f4f5;}',
  '[data-anydocs-slash-menu] [data-slash-item][data-active-item="true"]{background:#f4f4f5;}',
].join('');

function useSlashMenuStyles(): void {
  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById(STYLE_TAG_ID)) return;
    const tag = document.createElement('style');
    tag.id = STYLE_TAG_ID;
    tag.textContent = STYLE_RULES;
    document.head.appendChild(tag);
    // Leave the tag mounted — it is shared by every editor instance and
    // carries no per-instance state.
  }, []);
}

// Case-insensitive substring match over value/label/keywords. Preserves the
// `filterSlashItems` semantics (incl. CJK partial matches, which word-boundary
// filters miss).
function itemMatches(item: SlashMenuItem, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (q === '') return true;
  if (item.label.toLowerCase().includes(q)) return true;
  if (item.key.toLowerCase().includes(q)) return true;
  return item.keywords.some((k) => k.toLowerCase().includes(q));
}

type InlineComboboxContextValue = {
  inputProps: UseComboboxInputResult['props'];
  inputRef: React.RefObject<HTMLInputElement | null>;
  removeInput: UseComboboxInputResult['removeInput'];
  trigger: string;
};

const InlineComboboxContext = React.createContext<InlineComboboxContextValue>(
  null as unknown as InlineComboboxContextValue,
);

type InlineComboboxProps = {
  // Optional so React.createElement's variadic children satisfy it (TS won't
  // treat a required `children` as filled by trailing createElement args).
  children?: React.ReactNode;
  element: TElement;
  trigger: string;
};

// ariakit's component prop types are heavily overloaded; casting at the
// createElement boundary (like element-components.ts's PlateElementUnsafe)
// keeps call sites tidy without changing runtime behaviour. `open` is a valid
// ariakit ComboboxProvider store prop that the createElement overload misreads.
const ComboboxProviderUnsafe = ComboboxProvider as unknown as React.FC<Record<string, unknown>>;

function InlineCombobox(props: InlineComboboxProps): React.ReactElement {
  const { children, element, trigger } = props;
  const editor = useEditorRef();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const cursorState = useHTMLInputCursorState(inputRef);

  const [value, setValue] = React.useState('');

  // Track the point just before the input node so a cancel (non-backspace)
  // can re-insert the literal `/query` text the user had typed.
  const insertPoint = React.useRef<Point | null>(null);
  React.useEffect(() => {
    const editorApi = (editor as unknown as {
      api: {
        findPath: (el: unknown) => number[] | undefined;
        before: (at: number[]) => Point | undefined;
        pointRef: (p: Point) => { current: Point; unref: () => void };
      };
    }).api;
    const path = editorApi.findPath(element);
    if (!path) return;
    const point = editorApi.before(path);
    if (!point) return;
    const pointRef = editorApi.pointRef(point);
    insertPoint.current = pointRef.current;
    return () => {
      pointRef.unref();
    };
  }, [editor, element]);

  const { props: inputProps, removeInput } = useComboboxInput({
    cancelInputOnBlur: false,
    cursorState,
    // Focus the combobox input as soon as the `slash_input` node mounts so the
    // characters typed after `/` flow into the filter (single-user editor —
    // the local author is always the node's creator).
    autoFocus: true,
    ref: inputRef,
    onCancelInput: (cause) => {
      const tf = (editor as unknown as {
        tf: {
          insertText: (text: string, opts?: { at?: Point }) => void;
          move: (opts: { distance: number; reverse: boolean }) => void;
        };
      }).tf;
      if (cause !== 'backspace') {
        tf.insertText(trigger + value, { at: insertPoint.current ?? undefined });
      }
      if (cause === 'arrowLeft' || cause === 'arrowRight') {
        tf.move({ distance: 1, reverse: cause === 'arrowLeft' });
      }
    },
  });

  const contextValue = React.useMemo<InlineComboboxContextValue>(
    () => ({ inputProps, inputRef, removeInput, trigger }),
    [inputProps, removeInput, trigger],
  );

  const store = useComboboxStore({
    setValue: (newValue) => React.startTransition(() => setValue(newValue)),
  });

  const items = store.useState('items');
  React.useEffect(() => {
    if (!store.getState().activeId) {
      store.setActiveId(store.first());
    }
  }, [items, store]);

  return React.createElement(
    'span',
    { contentEditable: false },
    React.createElement(
      ComboboxProviderUnsafe,
      { open: items.length > 0, store },
      React.createElement(InlineComboboxContext.Provider, { value: contextValue }, children),
    ),
  );
}

function InlineComboboxInput(): React.ReactElement {
  const { inputProps, inputRef, trigger } = React.useContext(InlineComboboxContext);
  const store = useComboboxContext()!;
  const value = store.useState('value');
  const ref = useComposedRef(inputRef);

  // Auto-resizing input: a visually hidden span sizes the slot; the real
  // ariakit Combobox input is absolutely positioned over it.
  return React.createElement(
    React.Fragment,
    null,
    trigger,
    React.createElement(
      'span',
      { style: { position: 'relative', display: 'inline-block', minHeight: '1lh' } },
      React.createElement(
        'span',
        { 'aria-hidden': 'true', style: { visibility: 'hidden', whiteSpace: 'nowrap', overflow: 'hidden' } },
        value || '​',
      ),
      React.createElement(Combobox, {
        ref,
        value,
        autoSelect: true,
        style: {
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'transparent',
          outline: 'none',
          border: 'none',
        },
        ...inputProps,
      }),
    ),
  );
}

function InlineComboboxContent(props: { children: React.ReactNode }): React.ReactElement {
  return React.createElement(
    Portal,
    null,
    React.createElement(
      ComboboxPopover,
      {
        'data-anydocs-slash-menu': 'true',
        role: 'listbox',
        'aria-label': 'Insert block',
        gutter: 4,
        style: POPOVER_STYLE,
      },
      props.children,
    ),
  );
}

type InlineComboboxItemProps = {
  item: SlashMenuItem;
  onSelect: () => void;
};

function InlineComboboxItem(props: InlineComboboxItemProps): React.ReactElement | null {
  const { item, onSelect } = props;
  const { removeInput } = React.useContext(InlineComboboxContext);
  const store = useComboboxContext()!;
  const search = store.useState('value');

  const visible = React.useMemo(() => itemMatches(item, search), [item, search]);
  if (!visible) return null;

  const itemProps: ComboboxItemProps & { 'data-slash-item': string } = {
    value: item.key,
    'data-slash-item': item.key,
    focusOnHover: true,
    style: ITEM_STYLE,
    onClick: () => {
      removeInput(true);
      onSelect();
    },
  };

  return React.createElement(
    ComboboxItem,
    itemProps,
    React.createElement('div', { style: { fontWeight: 500 } }, item.label),
    React.createElement('div', { style: { fontSize: 12, color: '#71717a' } }, item.description),
  );
}

function InlineComboboxEmpty(): React.ReactElement | null {
  const store = useComboboxContext()!;
  const items = store.useState('items');
  if (items.length > 0) return null;
  return React.createElement('div', { style: EMPTY_STYLE }, 'No results');
}

// `PlateElement`'s props are heavily generic; cast at the boundary like
// element-components.ts does. Runtime behaviour is unaffected.
const PlateElementUnsafe = PlateElement as unknown as React.FC<Record<string, unknown>>;

/**
 * Render component for the transient `slash_input` node. Registered via
 * `override.components` under the `slash_input` type. Renders the inline
 * combobox in place of the node and lists the block catalogue.
 */
export function SlashInputElement(props: PlateElementProps): React.ReactElement {
  useSlashMenuStyles();
  const editor = useEditorRef();
  const element = props.element as unknown as TElement;

  return React.createElement(
    PlateElementUnsafe,
    { ...(props as unknown as Record<string, unknown>), as: 'span' },
    React.createElement(
      InlineCombobox,
      { element, trigger: '/' },
      React.createElement(InlineComboboxInput),
      React.createElement(
        InlineComboboxContent,
        null,
        React.createElement(InlineComboboxEmpty),
        ...SLASH_MENU_ITEMS.map((item) =>
          React.createElement(InlineComboboxItem, {
            key: item.key,
            item,
            onSelect: () => applySlashItemAtSelection(editor, item),
          }),
        ),
      ),
    ),
    props.children,
  );
}
