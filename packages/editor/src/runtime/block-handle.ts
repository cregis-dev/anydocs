// =============================================================================
// Block handle — visual block operations
// -----------------------------------------------------------------------------
// Notion-style per-block affordance: hovering a top-level block shows a grip
// button in the left gutter; clicking it opens a menu with:
//   * Move up / Move down  (covers reordering without a drag-and-drop stack)
//   * Delete
//   * Turn into …          (convert the block to another type, carrying the
//                           inline content where the shapes allow it)
//
// Same architecture as slash-menu.ts: a controller component mounted as a
// sibling of <PlateContent> inside the <Plate> tree, DOM-located via a hidden
// anchor span, menu rendered through a portal to <body>, inline styles only,
// pure `.ts` (React.createElement), zero new dependencies. Drag-to-reorder is
// a deliberate non-goal for v1 (it drags in the react-dnd stack); Move
// up/down covers the need.
//
// Node shapes MUST stay in sync with the builtin plugin converters — see the
// matching note in slash-menu.ts.
// =============================================================================

import * as React from 'react';
import { createPortal } from 'react-dom';

import { useEditorRef } from '@udecode/plate/react';

import {
  PLATE_BLOCKQUOTE,
  PLATE_CALLOUT,
  PLATE_CODE_BLOCK,
  PLATE_HEADING,
  PLATE_LIST_BULLETED,
  PLATE_LIST_ITEM,
  PLATE_LIST_ITEM_TODO,
  PLATE_LIST_NUMBERED,
  PLATE_LIST_TODO,
  PLATE_PARAGRAPH,
} from '../converters/element-types.ts';

// -----------------------------------------------------------------------------
// Editor structural minimum
// -----------------------------------------------------------------------------

type AnyNode = { type?: string; text?: string; children?: AnyNode[] } & Record<string, unknown>;

type BlockEditor = {
  children: AnyNode[];
  api: {
    start: (at: number[]) => unknown;
  };
  tf: {
    removeNodes: (opts: { at: number[] }) => void;
    insertNodes: (node: unknown, opts: { at: number[] }) => void;
    moveNodes: (opts: { at: number[]; to: number[] }) => void;
    select: (at: unknown) => void;
    focus: () => void;
  };
};

// -----------------------------------------------------------------------------
// Pure transforms (exported for tests)
// -----------------------------------------------------------------------------

/** Moves the top-level block at `from` to `to` (indices). No-op when out of range. */
export function moveBlock(editorLike: unknown, from: number, to: number): void {
  const editor = editorLike as BlockEditor;
  const count = editor.children.length;
  if (from < 0 || from >= count || to < 0 || to >= count || from === to) return;
  editor.tf.moveNodes({ at: [from], to: [to] });
}

/**
 * Deletes the top-level block at `index`. When the document would become
 * empty, inserts a fresh empty paragraph so the editor always has a block to
 * type into.
 */
export function deleteBlock(editorLike: unknown, index: number): void {
  const editor = editorLike as BlockEditor;
  if (index < 0 || index >= editor.children.length) return;
  editor.tf.removeNodes({ at: [index] });
  if (editor.children.length === 0) {
    editor.tf.insertNodes({ type: PLATE_PARAGRAPH, children: [{ text: '' }] }, { at: [0] });
  }
}

// Source block types whose children are already inline nodes — these convert
// carrying marks and links; everything else flattens to plain text first.
const TEXT_CONTAINER_TYPES = new Set<string>([
  PLATE_PARAGRAPH,
  PLATE_HEADING[1],
  PLATE_HEADING[2],
  PLATE_HEADING[3],
  PLATE_BLOCKQUOTE,
  PLATE_CALLOUT,
]);

function collectText(node: AnyNode): string {
  if (typeof node.text === 'string') return node.text;
  if (!Array.isArray(node.children)) return '';
  return node.children.map(collectText).join('');
}

/**
 * Extracts the inline content of a block for conversion. Text-container
 * blocks keep their inline children (marks + links survive); structural
 * blocks (lists, tables, code) flatten to a single plain-text node.
 */
function extractInlineChildren(block: AnyNode): AnyNode[] {
  if (block.type !== undefined && TEXT_CONTAINER_TYPES.has(block.type) && Array.isArray(block.children)) {
    return block.children;
  }
  const text = collectText(block);
  return [{ text }];
}

export type TurnIntoItem = {
  key: string;
  label: string;
  /** Builds the replacement node from the source block's inline children. */
  build: (children: AnyNode[]) => Record<string, unknown>;
  /** Plate element type produced — used to mark the current type in the UI. */
  produces: string;
};

export const TURN_INTO_ITEMS: ReadonlyArray<TurnIntoItem> = [
  {
    key: 'paragraph',
    label: 'Text',
    produces: PLATE_PARAGRAPH,
    build: (children) => ({ type: PLATE_PARAGRAPH, children }),
  },
  {
    key: 'h1',
    label: 'Heading 1',
    produces: PLATE_HEADING[1],
    build: (children) => ({ type: PLATE_HEADING[1], children }),
  },
  {
    key: 'h2',
    label: 'Heading 2',
    produces: PLATE_HEADING[2],
    build: (children) => ({ type: PLATE_HEADING[2], children }),
  },
  {
    key: 'h3',
    label: 'Heading 3',
    produces: PLATE_HEADING[3],
    build: (children) => ({ type: PLATE_HEADING[3], children }),
  },
  {
    key: 'blockquote',
    label: 'Quote',
    produces: PLATE_BLOCKQUOTE,
    build: (children) => ({ type: PLATE_BLOCKQUOTE, children }),
  },
  {
    key: 'callout',
    label: 'Callout',
    produces: PLATE_CALLOUT,
    build: (children) => ({ type: PLATE_CALLOUT, tone: 'info', children }),
  },
  {
    key: 'bulleted-list',
    label: 'Bulleted list',
    produces: PLATE_LIST_BULLETED,
    build: (children) => ({
      type: PLATE_LIST_BULLETED,
      children: [{ type: PLATE_LIST_ITEM, children }],
    }),
  },
  {
    key: 'numbered-list',
    label: 'Numbered list',
    produces: PLATE_LIST_NUMBERED,
    build: (children) => ({
      type: PLATE_LIST_NUMBERED,
      children: [{ type: PLATE_LIST_ITEM, children }],
    }),
  },
  {
    key: 'todo-list',
    label: 'To-do list',
    produces: PLATE_LIST_TODO,
    build: (children) => ({
      type: PLATE_LIST_TODO,
      children: [{ type: PLATE_LIST_ITEM_TODO, checked: false, children }],
    }),
  },
  {
    key: 'code-block',
    label: 'Code block',
    produces: PLATE_CODE_BLOCK,
    // Code holds raw text only — flatten whatever inline content arrives.
    build: (children) => ({
      type: PLATE_CODE_BLOCK,
      children: [{ text: children.map(collectText).join('') }],
    }),
  },
];

/**
 * Converts the top-level block at `index` to the target type, carrying the
 * inline content. Caret lands at the start of the converted block.
 */
export function turnBlockInto(editorLike: unknown, index: number, item: TurnIntoItem): void {
  const editor = editorLike as BlockEditor;
  const block = editor.children[index];
  if (!block) return;
  const inline = extractInlineChildren(block);
  const safeInline = inline.length > 0 ? inline : [{ text: '' }];
  editor.tf.removeNodes({ at: [index] });
  editor.tf.insertNodes(item.build(safeInline), { at: [index] });
  try {
    editor.tf.select(editor.api.start([index]));
  } catch {
    // best-effort caret placement
  }
  try {
    // Focus only when mounted — see the matching note in slash-menu.ts.
    const maybeDom = (editor as unknown as { api: { toDOMNode?: (n: unknown) => unknown } }).api.toDOMNode?.(editor);
    if (maybeDom) editor.tf.focus();
  } catch {
    // unmounted — skip focus
  }
}

// -----------------------------------------------------------------------------
// Controller component
// -----------------------------------------------------------------------------

type HandleState = {
  blockIndex: number;
  // Viewport coordinates for the grip button (position: fixed).
  left: number;
  top: number;
};

type MenuState = {
  blockIndex: number;
  left: number;
  top: number;
};

const GRIP_STYLE: React.CSSProperties = {
  position: 'fixed',
  zIndex: 999,
  width: 22,
  height: 22,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  borderRadius: 4,
  background: 'transparent',
  color: '#a1a1aa',
  cursor: 'grab',
  fontSize: 14,
  lineHeight: 1,
  padding: 0,
};

const MENU_STYLE: React.CSSProperties = {
  position: 'fixed',
  zIndex: 1000,
  minWidth: 200,
  maxHeight: 360,
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

const MENU_ITEM_STYLE: React.CSSProperties = {
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

const SECTION_LABEL_STYLE: React.CSSProperties = {
  padding: '6px 10px 2px',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  color: '#a1a1aa',
};

function menuItem(
  key: string,
  label: string,
  onPick: () => void,
  opts?: { disabled?: boolean; danger?: boolean; active?: boolean },
): React.ReactElement {
  return React.createElement(
    'button',
    {
      key,
      type: 'button',
      disabled: opts?.disabled === true,
      style: {
        ...MENU_ITEM_STYLE,
        color: opts?.danger ? '#dc2626' : opts?.disabled ? '#d4d4d8' : 'inherit',
        cursor: opts?.disabled ? 'default' : 'pointer',
        fontWeight: opts?.active ? 600 : 400,
      },
      // preventDefault keeps editor focus/selection intact (same pattern as
      // the slash menu).
      onMouseDown: (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        if (opts?.disabled !== true) onPick();
      },
    },
    opts?.active ? `${label} ✓` : label,
  );
}

/**
 * Mounted as a sibling of `<PlateContent>` (see plate-runtime.ts). Tracks the
 * hovered top-level block and renders the grip + operations menu.
 */
export function BlockHandleController(): React.ReactElement {
  const editor = useEditorRef() as unknown as BlockEditor;
  const [handle, setHandle] = React.useState<HandleState | null>(null);
  const [menu, setMenu] = React.useState<MenuState | null>(null);
  const handleRef = React.useRef<HandleState | null>(null);
  handleRef.current = handle;
  const menuRef = React.useRef<MenuState | null>(null);
  menuRef.current = menu;
  const anchorRef = React.useRef<HTMLSpanElement | null>(null);
  const gripRef = React.useRef<HTMLButtonElement | null>(null);
  // The element carrying the hover listeners. Cached so the render-phase grip
  // handlers (below) can tell whether the pointer is moving back INTO the
  // editor vs. away from it.
  const containerRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    const container = anchorRef.current?.parentElement;
    const editable = container?.querySelector<HTMLElement>('[data-slate-editor="true"]') ?? undefined;
    if (!container || !editable) return;
    containerRef.current = container;

    function topLevelBlockFromEvent(event: MouseEvent): { el: HTMLElement; index: number } | null {
      const target = event.target as HTMLElement | null;
      if (!target || !editable) return null;
      let el: HTMLElement | null = target.closest<HTMLElement>('[data-slate-node="element"]');
      if (el === null) return null;
      while (el.parentElement !== editable) {
        const next: HTMLElement | null =
          el.parentElement?.closest<HTMLElement>('[data-slate-node="element"]') ?? null;
        if (next === null) return null;
        el = next;
      }
      const index = Array.prototype.indexOf.call(editable.children, el);
      if (index < 0) return null;
      return { el, index };
    }

    function onMouseMove(event: MouseEvent): void {
      // Freeze the handle while its menu is open.
      if (menuRef.current !== null) return;
      // Hovering the grip itself must not clear the handle.
      if (gripRef.current && event.target instanceof Node && gripRef.current.contains(event.target)) {
        return;
      }
      const hit = topLevelBlockFromEvent(event);
      if (hit === null) return;
      const rect = hit.el.getBoundingClientRect();
      const prev = handleRef.current;
      const next: HandleState = {
        blockIndex: hit.index,
        left: Math.max(rect.left - 28, 4),
        top: rect.top + 2,
      };
      if (prev === null || prev.blockIndex !== next.blockIndex || Math.abs(prev.top - next.top) > 1) {
        setHandle(next);
      }
    }

    function onMouseLeave(event: MouseEvent): void {
      if (menuRef.current !== null) return;
      // The grip is portaled to <body>, so it sits OUTSIDE this container's
      // DOM subtree (and geometrically in the left gutter). Moving the pointer
      // from a block toward the grip therefore fires this `mouseleave` — and
      // without the relatedTarget guard the handle was cleared before the
      // user could ever click the grip. Skip clearing when the pointer is
      // heading onto the grip or the open menu.
      const related = event.relatedTarget;
      if (related instanceof Node) {
        if (gripRef.current?.contains(related)) return;
        const menuEl = document.querySelector('[data-anydocs-block-menu]');
        if (menuEl && menuEl.contains(related)) return;
      }
      setHandle(null);
    }

    function onDocMouseDown(event: MouseEvent): void {
      // Any mousedown outside the menu closes it (menu buttons preventDefault
      // on mousedown before this listener sees a chance to act on focus, and
      // close themselves explicitly).
      if (menuRef.current !== null) {
        const menuEl = document.querySelector('[data-anydocs-block-menu]');
        if (menuEl && event.target instanceof Node && menuEl.contains(event.target)) return;
        setMenu(null);
        setHandle(null);
      }
    }

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape' && menuRef.current !== null) {
        event.preventDefault();
        setMenu(null);
      }
    }

    function onScrollOrResize(): void {
      // Fixed-position coordinates go stale on scroll; just hide.
      if (menuRef.current === null && handleRef.current === null) return;
      setMenu(null);
      setHandle(null);
    }

    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mouseleave', onMouseLeave);
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('mouseleave', onMouseLeave);
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
    // Mount-once wiring; the editor tree is rebuilt (new key) on host
    // setContent, which remounts this controller too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const anchor = React.createElement('span', {
    key: 'anchor',
    ref: anchorRef,
    style: { display: 'none' },
    'data-anydocs-block-anchor': 'true',
  });

  if (handle === null || typeof document === 'undefined') {
    return anchor;
  }

  const blockCount = editor.children.length;
  const blockType = editor.children[handle.blockIndex]?.type;

  const grip = React.createElement(
    'button',
    {
      key: 'grip',
      ref: gripRef,
      type: 'button',
      title: 'Block operations',
      'data-anydocs-block-grip': 'true',
      style: { ...GRIP_STYLE, left: handle.left, top: handle.top },
      onMouseDown: (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        if (menuRef.current !== null) {
          setMenu(null);
          return;
        }
        setMenu({
          blockIndex: handle.blockIndex,
          left: handle.left,
          top: handle.top + 24,
        });
      },
      onMouseLeave: (event: React.MouseEvent) => {
        // Hide the grip when the pointer abandons it to empty space. Keep it
        // when moving back into the editor (the container's mousemove will
        // re-target it) or onto the open menu.
        if (menuRef.current !== null) return;
        const related = event.relatedTarget;
        if (related instanceof Node) {
          if (containerRef.current?.contains(related)) return;
          const menuEl = document.querySelector('[data-anydocs-block-menu]');
          if (menuEl && menuEl.contains(related)) return;
        }
        setHandle(null);
      },
    },
    '⋮⋮',
  );

  function closeAll(): void {
    setMenu(null);
    setHandle(null);
  }

  const menuNode = menu === null
    ? null
    : React.createElement(
        'div',
        {
          key: 'menu',
          role: 'menu',
          'data-anydocs-block-menu': 'true',
          style: { ...MENU_STYLE, left: menu.left, top: menu.top },
        },
        menuItem('move-up', '↑ Move up', () => {
          moveBlock(editor, menu.blockIndex, menu.blockIndex - 1);
          closeAll();
        }, { disabled: menu.blockIndex === 0 }),
        menuItem('move-down', '↓ Move down', () => {
          moveBlock(editor, menu.blockIndex, menu.blockIndex + 1);
          closeAll();
        }, { disabled: menu.blockIndex >= blockCount - 1 }),
        menuItem('delete', 'Delete', () => {
          deleteBlock(editor, menu.blockIndex);
          closeAll();
        }, { danger: true }),
        React.createElement('div', { key: 'turn-into-label', style: SECTION_LABEL_STYLE }, 'Turn into'),
        TURN_INTO_ITEMS.map((item) =>
          menuItem(`turn-${item.key}`, item.label, () => {
            turnBlockInto(editor, menu.blockIndex, item);
            closeAll();
          }, { active: item.produces === blockType }),
        ),
      );

  return React.createElement(
    React.Fragment,
    null,
    anchor,
    createPortal(
      React.createElement(React.Fragment, null, grip, menuNode),
      document.body,
    ),
  );
}
