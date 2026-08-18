import {
  Children,
  isValidElement,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { contentLinkTargetProps } from '@/components/docs/content-link-target';
import { cn } from '@/lib/utils';

const markdownTableWrapperStyle: CSSProperties = {
  margin: '0.75rem 0',
  width: '100%',
  overflowX: 'auto',
  border: '1px solid var(--fd-border)',
  borderRadius: '0.5rem',
  background: 'var(--fd-card)',
};

const markdownTableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'separate',
  borderSpacing: 0,
  fontSize: '14px',
  lineHeight: 1.5,
};

const markdownTableHeaderCellStyle: CSSProperties = {
  background: 'var(--fd-muted)',
  padding: '0.5rem 0.75rem',
  textAlign: 'left',
  fontWeight: 600,
  color: 'var(--fd-foreground)',
  whiteSpace: 'nowrap',
};

const markdownTableCellStyle: CSSProperties = {
  borderTop: '1px solid var(--fd-border)',
  padding: '0.5rem 0.75rem',
  color: 'var(--docs-body-copy,var(--fd-muted-foreground))',
  verticalAlign: 'top',
};

type InlineCodeElement = ReactElement<{ children?: ReactNode }>;
type RuleListItem = { label: string; value: ReactNode[] };

const textRulePattern = /^\s*["“”'‘’]?([A-Za-z0-9_.-]{1,48})["“”'‘’]?\s*(?::|：|-|–|—)\s*([\s\S]*)$/;

function getReactNodeText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(getReactNodeText).join('');
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return getReactNodeText(node.props.children);
  }

  return '';
}

function isInlineCodeElement(node: ReactNode): node is InlineCodeElement {
  return isValidElement<{ children?: ReactNode }>(node) && node.type === 'code';
}

function splitInlineCodeRuleListItem(parts: ReactNode[], firstMeaningfulIndex: number): RuleListItem | null {
  const labelNode = parts[firstMeaningfulIndex];
  const separatorNode = parts[firstMeaningfulIndex + 1];

  if (!isInlineCodeElement(labelNode) || typeof separatorNode !== 'string') {
    return null;
  }

  const separatorMatch = separatorNode.match(/^\s*[:：]\s*/);

  if (!separatorMatch) {
    return null;
  }

  const label = getReactNodeText(labelNode).trim();
  const separatorRemainder = separatorNode.slice(separatorMatch[0].length);
  const value = separatorRemainder
    ? [separatorRemainder, ...parts.slice(firstMeaningfulIndex + 2)]
    : parts.slice(firstMeaningfulIndex + 2);

  if (!label || label.length > 48 || !getReactNodeText(value).trim()) {
    return null;
  }

  return { label, value };
}

function splitTextRuleListItem(parts: ReactNode[], firstMeaningfulIndex: number): RuleListItem | null {
  const labelNode = parts[firstMeaningfulIndex];

  if (typeof labelNode !== 'string') {
    return null;
  }

  const match = labelNode.match(textRulePattern);

  if (!match) {
    return null;
  }

  const [, label, firstValueChunk] = match;
  const value = firstValueChunk ? [firstValueChunk, ...parts.slice(firstMeaningfulIndex + 1)] : parts.slice(firstMeaningfulIndex + 1);

  if (!label || !getReactNodeText(value).trim()) {
    return null;
  }

  return { label, value };
}

function splitTextRuleLine(line: string): RuleListItem | null {
  const match = line.match(textRulePattern);

  if (!match) {
    return null;
  }

  const [, label, value] = match;

  if (!label || !value.trim()) {
    return null;
  }

  return { label, value: [value] };
}

function splitRuleListItem(children: ReactNode): RuleListItem | null {
  const parts = Children.toArray(children);
  const firstMeaningfulIndex = parts.findIndex((part) => typeof part !== 'string' || part.trim().length > 0);

  if (firstMeaningfulIndex < 0) {
    return null;
  }

  return splitInlineCodeRuleListItem(parts, firstMeaningfulIndex) ?? splitTextRuleListItem(parts, firstMeaningfulIndex);
}

function splitRuleParagraph(children: ReactNode): RuleListItem[] | null {
  const lines = getReactNodeText(children)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return null;
  }

  const rules = lines.map(splitTextRuleLine);

  if (rules.some((rule) => !rule)) {
    return null;
  }

  return rules as RuleListItem[];
}

function InlineMarkdownLink({ href, ...props }: ComponentPropsWithoutRef<'a'>) {
  return <a {...props} href={href} {...contentLinkTargetProps(href)} />;
}

/**
 * 轻量内联 markdown 渲染，用于 operation/字段描述。
 * 与文档正文的 MarkdownView 区分：字号更小、无 heading 锚点逻辑，适配参考页的紧凑排版。
 */
export function InlineMarkdown({ children, className }: { children: string; className?: string }) {
  const shouldFormatRuleLists = className?.split(/\s+/).includes('schema-field-description') ?? false;

  return (
    <div
      className={cn(
        'prose prose-neutral max-w-none',
        'prose-p:my-2 prose-p:text-[15px] prose-p:leading-7 prose-p:text-[color:var(--docs-body-copy,var(--fd-muted-foreground))]',
        'prose-li:my-0.5 prose-li:text-[14px] prose-li:leading-6 prose-li:text-[color:var(--docs-body-copy,var(--fd-muted-foreground))]',
        'prose-headings:text-[15px] prose-headings:font-semibold prose-headings:text-fd-foreground',
        'prose-strong:font-semibold prose-strong:text-fd-foreground',
        'prose-a:font-medium prose-a:text-[color:var(--docs-link,var(--fd-primary))] prose-a:underline prose-a:underline-offset-2',
        'prose-code:rounded prose-code:bg-fd-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:font-normal prose-code:text-fd-foreground prose-code:before:content-none prose-code:after:content-none',
        'prose-pre:overflow-x-auto prose-pre:rounded-lg prose-pre:border prose-pre:border-fd-border prose-pre:bg-[#0f172a] prose-pre:p-3 prose-pre:text-[12px] prose-pre:text-slate-100',
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: InlineMarkdownLink,
          table({ node, style, ...props }) {
            void node;
            return (
              <div data-inline-markdown-table style={markdownTableWrapperStyle}>
                <table {...props} style={{ ...markdownTableStyle, ...style }} />
              </div>
            );
          },
          th({ node, style, ...props }) {
            void node;
            return <th {...props} style={{ ...markdownTableHeaderCellStyle, ...style }} />;
          },
          td({ node, style, ...props }) {
            void node;
            return <td {...props} style={{ ...markdownTableCellStyle, ...style }} />;
          },
          p({ node, children: paragraphChildren, className: paragraphClassName, ...props }) {
            void node;
            const rules = shouldFormatRuleLists ? splitRuleParagraph(paragraphChildren) : null;

            if (!rules) {
              return (
                <p {...props} className={paragraphClassName}>
                  {paragraphChildren}
                </p>
              );
            }

            return (
              <ul className="schema-rule-list schema-rule-list-from-paragraph">
                {rules.map((rule) => (
                  <li className="schema-rule-row" key={rule.label}>
                    <span className="schema-rule-label">{rule.label}</span>
                    <span className="schema-rule-value">{rule.value}</span>
                  </li>
                ))}
              </ul>
            );
          },
          li({ node, children: listItemChildren, className: listItemClassName, ...props }) {
            void node;
            const rule = shouldFormatRuleLists ? splitRuleListItem(listItemChildren) : null;

            if (!rule) {
              return (
                <li {...props} className={listItemClassName}>
                  {listItemChildren}
                </li>
              );
            }

            return (
              <li {...props} className={cn('schema-rule-row', listItemClassName)}>
                <span className="schema-rule-label">{rule.label}</span>
                <span className="schema-rule-value">{rule.value}</span>
              </li>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
