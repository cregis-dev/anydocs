// =============================================================================
// @anydocs/editor — Plate element render components (Story 13.x prelude)
// -----------------------------------------------------------------------------
// Plate v49 ships its plugin packages (`@udecode/plate-heading/react`, etc.)
// WITHOUT React render components: they declare the element type names, key
// bindings, and serializers, but leave UI to the host. Without a component
// for each `node.type`, Plate falls back to rendering every block as an
// unstyled `<div data-slate-element>` — which is what the Studio cutover
// PR initially shipped (Story 6.4 misread `@udecode/plate-*` as
// "components included").
//
// This file fills the gap with minimal element components matching the 11
// canonical DocContentV1 block types (plus the `a` inline). Components use
// semantic HTML tags + Tailwind utility classes (Studio already pipes
// Tailwind into the editor host). They are passed via
// `override.components` to `createPlateEditor` — see plate-runtime.ts.
//
// Targeted style fidelity: enough to make the editor recognisable as a
// real rich-text editor (proper heading scale, list markers, code-block
// monospace, callout color, table grid lines). Full shadcn polish lands
// with the dedicated UI follow-up.
// =============================================================================

import * as React from 'react';
import { PlateElement, type PlateElementProps } from '@udecode/plate/react';

import {
  PLATE_BLOCKQUOTE,
  PLATE_CALLOUT,
  PLATE_CODE_BLOCK,
  PLATE_CODE_GROUP,
  PLATE_DIVIDER,
  PLATE_HEADING,
  PLATE_IMAGE,
  PLATE_LINK,
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

// Plate v49 component props the runtime passes in. We accept `unknown` and
// narrow inside; using `PlateElementProps` directly would require generics
// the host doesn't know about. Each component just forwards
// `attributes` + `children` to its HTML tag and reads block-level fields
// (`level`, `tone`, `src`, …) off `element` for the variants.
type AnyElementProps = PlateElementProps;

type ElementComponent = (props: AnyElementProps) => React.ReactElement;

// `PlateElement`'s `as`/`href`/`role`/etc. typing tracks the literal value of
// `as`, but our `classed` helper is generic over many tags. Casting the
// component reference to `React.FC<Record<string, unknown>>` at the
// createElement boundary keeps the call sites tidy without sacrificing
// runtime correctness — PlateElement passes the unknown props through to
// the chosen tag.
const PlateElementUnsafe = PlateElement as unknown as React.FC<Record<string, unknown>>;

function classed(
  as: keyof HTMLElementTagNameMap,
  className: string,
): ElementComponent {
  return function Element(props) {
    return React.createElement(
      PlateElementUnsafe,
      { ...props, as, className },
      props.children,
    );
  };
}

// -- Paragraph ----------------------------------------------------------------

const ParagraphElement: ElementComponent = classed('p', 'mb-2 leading-7');

// -- Headings -----------------------------------------------------------------

const HeadingOneElement: ElementComponent = classed(
  'h1',
  'mt-6 mb-4 scroll-m-20 text-4xl font-bold tracking-tight',
);
const HeadingTwoElement: ElementComponent = classed(
  'h2',
  'mt-5 mb-3 scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0',
);
const HeadingThreeElement: ElementComponent = classed(
  'h3',
  'mt-4 mb-2 scroll-m-20 text-2xl font-semibold tracking-tight',
);

// -- Lists --------------------------------------------------------------------

const BulletedListElement: ElementComponent = classed(
  'ul',
  'mb-2 ml-6 list-disc [&_ul]:list-[circle] [&_ul_ul]:list-[square]',
);
const NumberedListElement: ElementComponent = classed(
  'ol',
  'mb-2 ml-6 list-decimal',
);
const TodoListElement: ElementComponent = classed(
  'ul',
  'mb-2 ml-6 list-none [&_li]:flex [&_li]:items-start [&_li]:gap-2',
);
const ListItemElement: ElementComponent = classed('li', 'mt-0.5');
const TodoListItemElement: ElementComponent = function TodoListItem(props) {
  const element = props.element as { checked?: boolean };
  // Pure-`.ts` (no JSX), so build the children via createElement. The
  // checkbox is rendered as a static read-only marker; toggling lands
  // with the Story 13.x interactive todo plugin.
  return React.createElement(
    PlateElementUnsafe,
    { ...props, as: 'li', className: 'mt-0.5 flex items-start gap-2' },
    React.createElement('span', {
      contentEditable: false,
      'aria-hidden': true,
      className:
        'mt-1 inline-block h-4 w-4 shrink-0 rounded border ' +
        (element.checked
          ? 'bg-zinc-900 border-zinc-900 dark:bg-zinc-100 dark:border-zinc-100'
          : 'border-zinc-300 dark:border-zinc-600'),
    }),
    React.createElement(
      'span',
      { className: element.checked ? 'line-through text-zinc-500' : '' },
      props.children,
    ),
  );
};

// -- Code blocks --------------------------------------------------------------

const CodeBlockElement: ElementComponent = classed(
  'pre',
  'mb-2 overflow-x-auto rounded-md bg-zinc-100 p-4 font-mono text-sm leading-6 dark:bg-zinc-800',
);
const CodeGroupElement: ElementComponent = classed(
  'div',
  'mb-2 rounded-md border border-zinc-200 dark:border-zinc-700',
);

// -- Quote / Callout ----------------------------------------------------------

const BlockquoteElement: ElementComponent = classed(
  'blockquote',
  'mb-2 border-l-4 border-zinc-300 pl-4 italic text-zinc-700 dark:border-zinc-600 dark:text-zinc-300',
);

const CALLOUT_TONE_CLASS: Record<string, string> = {
  info: 'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-100',
  warning: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100',
  success: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100',
  danger: 'border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-100',
  note: 'border-zinc-300 bg-zinc-50 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100',
};

const CalloutElement: ElementComponent = function Callout(props) {
  const element = props.element as { tone?: string; title?: string };
  const toneClass = (element.tone && CALLOUT_TONE_CLASS[element.tone]) ||
    CALLOUT_TONE_CLASS.note;
  return React.createElement(
    PlateElementUnsafe,
    {
      ...props,
      as: 'div',
      role: 'note',
      className: `mb-2 rounded-md border-l-4 p-4 ${toneClass}`,
    },
    element.title
      ? React.createElement(
          'div',
          { className: 'mb-1 font-semibold', contentEditable: false },
          element.title,
        )
      : null,
    props.children,
  );
};

// -- Tables -------------------------------------------------------------------

// `<tr>` rows must sit inside a `<tbody>` — the browser auto-inserts one when
// parsing raw `<table><tr>` HTML, so rendering rows as direct table children
// makes React's tree diverge from the parsed DOM (hydration-error console
// noise in dev, and a real hydration hazard wherever the editor output is
// server-rendered). Wrap the slate children explicitly.
const TableElement: ElementComponent = function Table(props) {
  return React.createElement(
    PlateElementUnsafe,
    {
      ...props,
      as: 'table',
      className:
        'mb-2 w-full border-collapse text-sm [&_td]:border [&_th]:border [&_td]:border-zinc-300 [&_th]:border-zinc-300 [&_td]:p-2 [&_th]:p-2 dark:[&_td]:border-zinc-700 dark:[&_th]:border-zinc-700',
    },
    React.createElement('tbody', null, props.children),
  );
};
const TableRowElement: ElementComponent = classed('tr', '');
const TableHeaderCellElement: ElementComponent = classed(
  'th',
  'bg-zinc-100 text-left font-semibold dark:bg-zinc-800',
);
const TableCellElement: ElementComponent = classed('td', '');

// -- Media / Voids ------------------------------------------------------------

// DocContentV1's `image.caption` is an INLINE-NODE ARRAY, which the image
// converter maps to Plate text nodes (`{ text, ...marks }`). Rendering that
// array directly as a React child crashes the whole editor tree ("Objects
// are not valid as a React child (found: object with keys {text})") on any
// page with a captioned image. Flatten to plain text for the read-only
// figcaption; rich caption editing is future-story scope.
function inlineNodesToPlainText(nodes: unknown): string {
  if (typeof nodes === 'string') return nodes;
  if (!Array.isArray(nodes)) return '';
  let out = '';
  for (const node of nodes) {
    if (node === null || typeof node !== 'object') continue;
    const candidate = node as { text?: unknown; children?: unknown };
    if (typeof candidate.text === 'string') {
      out += candidate.text;
    } else if (Array.isArray(candidate.children)) {
      out += inlineNodesToPlainText(candidate.children);
    }
  }
  return out;
}

const ImageElement: ElementComponent = function Image(props) {
  const element = props.element as {
    src?: string;
    alt?: string;
    title?: string;
    width?: number;
    height?: number;
    caption?: unknown;
  };
  const captionText = inlineNodesToPlainText(element.caption);
  return React.createElement(
    PlateElementUnsafe,
    {
      ...props,
      as: 'figure',
      className: 'mb-2 flex flex-col items-center gap-2',
    },
    React.createElement('img', {
      src: element.src ?? '',
      alt: element.alt ?? '',
      title: element.title,
      width: element.width,
      height: element.height,
      className: 'max-w-full rounded-md border border-zinc-200 dark:border-zinc-700',
      contentEditable: false,
    }),
    captionText
      ? React.createElement(
          'figcaption',
          {
            contentEditable: false,
            className: 'text-center text-xs text-zinc-500 dark:text-zinc-400',
          },
          captionText,
        )
      : null,
    // Plate requires us to render `children` somewhere even for void elements;
    // hide them visually so the void renders correctly without showing the
    // editor's invisible placeholder text.
    React.createElement(
      'span',
      { className: 'sr-only' },
      props.children,
    ),
  );
};

const DividerElement: ElementComponent = function Divider(props) {
  return React.createElement(
    PlateElementUnsafe,
    { ...props, as: 'div', className: 'mb-2' },
    React.createElement('hr', {
      contentEditable: false,
      className: 'border-zinc-200 dark:border-zinc-700',
    }),
    React.createElement(
      'span',
      { className: 'sr-only' },
      props.children,
    ),
  );
};

const MermaidElement: ElementComponent = function Mermaid(props) {
  const element = props.element as { code?: string; title?: string };
  return React.createElement(
    PlateElementUnsafe,
    {
      ...props,
      as: 'div',
      className:
        'mb-2 rounded-md border border-zinc-200 bg-zinc-50 p-4 font-mono text-xs leading-6 dark:border-zinc-700 dark:bg-zinc-900',
    },
    element.title
      ? React.createElement(
          'div',
          { className: 'mb-1 text-[10px] uppercase tracking-wider text-zinc-500', contentEditable: false },
          `mermaid: ${element.title}`,
        )
      : React.createElement(
          'div',
          { className: 'mb-1 text-[10px] uppercase tracking-wider text-zinc-500', contentEditable: false },
          'mermaid',
        ),
    React.createElement(
      'pre',
      { className: 'whitespace-pre-wrap', contentEditable: false },
      element.code ?? '',
    ),
    React.createElement(
      'span',
      { className: 'sr-only' },
      props.children,
    ),
  );
};

// -- Inline link --------------------------------------------------------------

const LinkElement: ElementComponent = function Link(props) {
  const element = props.element as { href?: string; title?: string };
  return React.createElement(
    PlateElementUnsafe,
    {
      ...props,
      as: 'a',
      // PlateElement only forwards `props.attributes` (+ className/style) to
      // the DOM tag — top-level extras like `href` are dropped by its
      // `useNodeAttributes` merge. Anchor-specific attributes therefore go
      // through `attributes`.
      attributes: {
        ...props.attributes,
        href: element.href ?? '#',
        title: element.title,
        target: '_blank',
        rel: 'noreferrer',
      },
      className:
        'text-blue-600 underline-offset-2 hover:underline dark:text-blue-400',
    },
    props.children,
  );
};

// =============================================================================
// Public element-components map. Keys MUST match the Plate element-type
// strings produced by the converters (see src/converters/element-types.ts).
// Pass into `createPlateEditor({ override: { components } })`.
// =============================================================================

export const BUILTIN_ELEMENT_COMPONENTS: Record<string, ElementComponent> = {
  [PLATE_PARAGRAPH]: ParagraphElement,
  [PLATE_HEADING[1]]: HeadingOneElement,
  [PLATE_HEADING[2]]: HeadingTwoElement,
  [PLATE_HEADING[3]]: HeadingThreeElement,
  [PLATE_LIST_BULLETED]: BulletedListElement,
  [PLATE_LIST_NUMBERED]: NumberedListElement,
  [PLATE_LIST_TODO]: TodoListElement,
  [PLATE_LIST_ITEM]: ListItemElement,
  [PLATE_LIST_ITEM_TODO]: TodoListItemElement,
  [PLATE_CODE_BLOCK]: CodeBlockElement,
  [PLATE_CODE_GROUP]: CodeGroupElement,
  [PLATE_BLOCKQUOTE]: BlockquoteElement,
  [PLATE_CALLOUT]: CalloutElement,
  [PLATE_TABLE]: TableElement,
  [PLATE_TABLE_ROW]: TableRowElement,
  [PLATE_TABLE_HEADER_CELL]: TableHeaderCellElement,
  [PLATE_TABLE_CELL]: TableCellElement,
  [PLATE_IMAGE]: ImageElement,
  [PLATE_DIVIDER]: DividerElement,
  [PLATE_MERMAID]: MermaidElement,
  [PLATE_LINK]: LinkElement,
};
