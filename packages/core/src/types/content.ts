export const DOC_CONTENT_VERSION = 1 as const;

export const DOC_CONTENT_BLOCK_TYPES = [
  'paragraph',
  'heading',
  'list',
  'codeBlock',
  'codeGroup',
  'blockquote',
  'callout',
  'table',
  'image',
  'divider',
  'mermaid',
] as const;

export const DOC_CONTENT_TEXT_MARKS = [
  'bold',
  'italic',
  'underline',
  'strike',
  'code',
] as const;

export const DOC_CONTENT_CALLOUT_TONES = [
  'info',
  'warning',
  'success',
  'danger',
  'note',
] as const;

export const DOC_CONTENT_AUTHORING_GUIDANCE = [
  'Prefer canonical DocContentV1 blocks over empty content objects or markdown-only placeholders.',
  'Use heading level 2 and 3 blocks to create meaningful section hierarchy for reader TOC extraction.',
  'Mix paragraphs with lists, callouts, code blocks, tables, images, and links when the source material warrants structure.',
  'Reserve heading level 1 for title-like leading content only; the reader already has the page title separately.',
  'Use codeGroup when presenting the same example in multiple languages or package managers.',
] as const;

export type DocContentBlockType = (typeof DOC_CONTENT_BLOCK_TYPES)[number];
export type TextMark = (typeof DOC_CONTENT_TEXT_MARKS)[number];
export type CalloutTone = (typeof DOC_CONTENT_CALLOUT_TONES)[number];

export type DocContentV1 = {
  version: typeof DOC_CONTENT_VERSION;
  blocks: DocBlock[];
};

export type DocBlock =
  | ParagraphBlock
  | HeadingBlock
  | ListBlock
  | CodeBlock
  | CodeGroupBlock
  | BlockquoteBlock
  | CalloutBlock
  | TableBlock
  | ImageBlock
  | DividerBlock
  | MermaidBlock;

export type InlineNode = TextNode | LinkNode;

export type TextNode = {
  type: 'text';
  text: string;
  marks?: TextMark[];
};

export type LinkNode = {
  type: 'link';
  href: string;
  title?: string;
  children: TextNode[];
};

export type ParagraphBlock = {
  type: 'paragraph';
  id?: string;
  children: InlineNode[];
};

export type HeadingBlock = {
  type: 'heading';
  id?: string;
  level: 1 | 2 | 3;
  children: InlineNode[];
};

export type ListBlock = {
  type: 'list';
  id?: string;
  style: 'bulleted' | 'numbered' | 'todo';
  items: ListItem[];
};

export type ListItem = {
  id?: string;
  children: InlineNode[];
  checked?: boolean;
  items?: ListItem[];
};

export type CodeBlock = {
  type: 'codeBlock';
  id?: string;
  language?: string;
  title?: string;
  code: string;
};

export type CodeGroupBlock = {
  type: 'codeGroup';
  id?: string;
  items: CodeGroupItem[];
};

export type CodeGroupItem = {
  id?: string;
  language?: string;
  title?: string;
  code: string;
};

export type BlockquoteBlock = {
  type: 'blockquote';
  id?: string;
  children: InlineNode[];
};

export type CalloutBlock = {
  type: 'callout';
  id?: string;
  tone?: CalloutTone;
  title?: string;
  children: InlineNode[];
};

export type TableBlock = {
  type: 'table';
  id?: string;
  rows: TableRow[];
};

export type TableRow = {
  id?: string;
  cells: TableCell[];
};

export type TableCell = {
  id?: string;
  header?: boolean;
  children: InlineNode[];
};

export type ImageBlock = {
  type: 'image';
  id?: string;
  src: string;
  alt?: string;
  title?: string;
  caption?: InlineNode[];
  width?: number;
  height?: number;
};

export type DividerBlock = {
  type: 'divider';
  id?: string;
};

export type MermaidBlock = {
  type: 'mermaid';
  id?: string;
  code: string;
  title?: string;
};
