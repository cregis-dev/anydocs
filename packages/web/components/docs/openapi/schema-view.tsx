import type { ResolvedSchema } from '@anydocs/core';
import { ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { InlineMarkdown } from '@/components/docs/openapi/inline-markdown';
import {
  formatSchemaDescription,
  hasFriendlySchemaLabel,
  schemaRefDisplayName,
  type SchemaLabelLang,
} from '@/components/docs/openapi/schema-format';

type SchemaDict = Record<string, ResolvedSchema>;

function isExpandable(schema: ResolvedSchema | undefined): boolean {
  if (!schema) {
    return false;
  }
  if (schema.ref || schema.composition || schema.properties) {
    return true;
  }
  if (schema.contentSchema) {
    return true;
  }
  if (schema.type === 'array') {
    return isExpandable(schema.items);
  }
  return false;
}

/** 解引用命名 schema；返回目标定义与是否构成循环。 */
function deref(schema: ResolvedSchema, schemas: SchemaDict, visited: string[]): { target: ResolvedSchema; cyclic: boolean; name?: string } {
  if (!schema.ref) {
    return { target: schema, cyclic: false };
  }
  if (visited.includes(schema.ref)) {
    return { target: schemas[schema.ref] ?? schema, cyclic: true, name: schema.ref };
  }
  return { target: schemas[schema.ref] ?? schema, cyclic: false, name: schema.ref };
}

function TypePill({ schema, lang }: { schema: ResolvedSchema | undefined; lang?: SchemaLabelLang }) {
  const label = schemaTypePillLabel(schema, lang);
  if (!label) {
    return null;
  }
  return (
    <code className="rounded-md border border-[color:var(--fd-border)] bg-[color:var(--fd-muted,rgba(0,0,0,0.04))] px-1.5 py-0.5 font-mono text-[11px] font-medium leading-5 text-fd-muted-foreground">
      {label}
    </code>
  );
}

function shouldShowTypePill(schema: ResolvedSchema | undefined, lang?: SchemaLabelLang): boolean {
  return Boolean(schemaTypePillLabel(schema, lang));
}

function isFriendlyCallbackUnion(schema: ResolvedSchema): boolean {
  if (!schema.composition || (schema.composition.kind !== 'oneOf' && schema.composition.kind !== 'anyOf')) {
    return false;
  }
  return schema.composition.members.length > 0 && schema.composition.members.every((member) => member.ref && hasFriendlySchemaLabel(member.ref));
}

function callbackUnionLabel(lang: SchemaLabelLang | undefined): string {
  return lang === 'zh' ? '回调数据对象' : 'Callback data object';
}

function schemaTypePillLabel(schema: ResolvedSchema | undefined, lang?: SchemaLabelLang): string | null {
  if (!schema) {
    return 'any';
  }
  if (schema.ref) {
    return hasFriendlySchemaLabel(schema.ref) ? schemaRefDisplayName(schema.ref, { lang }) : null;
  }
  if (isFriendlyCallbackUnion(schema)) {
    return callbackUnionLabel(lang);
  }
  if (schema.type === 'array') {
    const itemLabel = schemaTypePillLabel(schema.items, lang);
    return itemLabel && itemLabel !== 'any' ? `array<${itemLabel}>` : 'array';
  }
  if (schema.composition) {
    const separator = schema.composition.kind === 'allOf' ? ' & ' : ' | ';
    let parts = schema.composition.members
      .map((member) => schemaTypePillLabel(member, lang))
      .filter((part): part is string => Boolean(part));
    if (schema.composition.kind === 'allOf' && parts.length > 1) {
      parts = parts.filter((part) => part !== 'object');
    }
    if (parts.length > 0) {
      return parts.join(separator);
    }
    return schema.properties ? 'object' : null;
  }
  if (schema.type) {
    if (schema.contentMediaType === 'application/json') {
      return schema.format ? `${schema.type}<${schema.format}, json>` : `${schema.type}<json>`;
    }
    return schema.format ? `${schema.type}<${schema.format}>` : schema.type;
  }
  if (schema.properties) {
    return 'object';
  }
  if (schema.enum) {
    return 'enum';
  }
  return 'any';
}

function Constraints({ schema }: { schema: ResolvedSchema }) {
  const bits: string[] = [];
  if (schema.default !== undefined) {
    bits.push(`default: ${JSON.stringify(schema.default)}`);
  }
  if (schema.enum && schema.enum.length > 0) {
    bits.push(`enum: ${schema.enum.map((value) => JSON.stringify(value)).join(', ')}`);
  }
  if (bits.length === 0) {
    return null;
  }
  return <div className="mt-1.5 font-mono text-[10.5px] leading-5 tracking-[0.01em] text-fd-muted-foreground">{bits.join(' · ')}</div>;
}

function optionLabel(index: number, lang: SchemaLabelLang | undefined): string {
  return lang === 'zh' ? `选项 ${index + 1}` : `Option ${index + 1}`;
}

function ExpandIndicator({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'schema-expand-control mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-[color:var(--fd-border)] bg-[color:var(--fd-card,#fff)] text-fd-muted-foreground shadow-sm transition duration-200',
        className,
      )}
    >
      <ChevronRight className="schema-expand-icon size-4 transition-transform duration-200" />
    </span>
  );
}

function ExpandableSummary({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <summary
      className={cn(
        'schema-expand-summary -mx-2 flex cursor-pointer list-none items-start gap-2.5 rounded-lg border border-[color:var(--fd-border)] bg-[color:var(--fd-card,#fff)] px-2 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--docs-accent,var(--fd-primary))] focus-visible:ring-offset-2',
        '[&::-webkit-details-marker]:hidden',
        className,
      )}
    >
      <ExpandIndicator />
      {children}
    </summary>
  );
}

function StructuredContentSchema({
  schema,
  schemas,
  visited,
  showRequired,
  lang,
}: {
  schema: ResolvedSchema;
  schemas: SchemaDict;
  visited: string[];
  showRequired: boolean;
  lang?: SchemaLabelLang;
}) {
  if (!schema.contentSchema) {
    return null;
  }

  return (
    <div className="mt-2 rounded-md border border-[color:var(--fd-border)] bg-[color:var(--fd-muted,rgba(0,0,0,0.03))] p-2.5">
      <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[12px] font-medium text-fd-muted-foreground">
        <span>JSON 内部字段</span>
        {schema.contentMediaType ? <code className="font-mono text-[11px]">{schema.contentMediaType}</code> : null}
      </div>
      <SchemaView schema={schema.contentSchema} schemas={schemas} visited={visited} showRequired={showRequired} lang={lang} />
    </div>
  );
}

function orderedPropertyEntries(
  properties: Record<string, ResolvedSchema>,
  required: Set<string>,
): Array<[string, ResolvedSchema]> {
  const entries = Object.entries(properties);
  if (properties.code && properties.msg && properties.data) {
    const envelopeOrder = ['code', 'msg', 'data'];
    const envelopeEntries = envelopeOrder.map((name) => [name, properties[name]!] as [string, ResolvedSchema]);
    const rest = entries.filter(([name]) => !envelopeOrder.includes(name));
    return [
      ...envelopeEntries,
      ...rest.filter(([name]) => required.has(name)),
      ...rest.filter(([name]) => !required.has(name)),
    ];
  }
  return [
    ...entries.filter(([name]) => required.has(name)),
    ...entries.filter(([name]) => !required.has(name)),
  ];
}

function collectObjectView(
  schema: ResolvedSchema,
  schemas: SchemaDict,
  visited: string[],
): { properties: Record<string, ResolvedSchema>; required: Set<string> } | undefined {
  const properties = new Map<string, ResolvedSchema>();
  const required = new Set(schema.required ?? []);

  const mergeProperties = (source: ResolvedSchema) => {
    for (const [name, value] of Object.entries(source.properties ?? {})) {
      properties.set(name, value);
    }
    for (const name of source.required ?? []) {
      required.add(name);
    }
  };

  const mergeSchema = (source: ResolvedSchema, sourceVisited: string[]) => {
    const { target, cyclic, name } = deref(source, schemas, sourceVisited);
    if (cyclic) {
      return;
    }
    const nextVisited = name ? [...sourceVisited, name] : sourceVisited;
    const nested = collectObjectView(target, schemas, nextVisited);
    if (!nested) {
      mergeProperties(target);
      return;
    }
    for (const [propName, propSchema] of Object.entries(nested.properties)) {
      properties.set(propName, propSchema);
    }
    for (const propName of nested.required) {
      required.add(propName);
    }
  };

  if (schema.composition?.kind === 'allOf') {
    for (const member of schema.composition.members) {
      mergeSchema(member, visited);
    }
    mergeProperties(schema);
  } else {
    mergeProperties(schema);
  }

  if (properties.size === 0) {
    return undefined;
  }

  return { properties: Object.fromEntries(properties), required };
}

function PropertyRow({
  name,
  schema,
  required,
  schemas,
  visited,
  showRequired,
  lang,
}: {
  name: string;
  schema: ResolvedSchema;
  required: boolean;
  schemas: SchemaDict;
  visited: string[];
  showRequired: boolean;
  lang?: SchemaLabelLang;
}) {
  const expandable = isExpandable(schema);

  const header = (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <code className="schema-field-name font-mono tracking-[-0.01em]">{name}</code>
      <TypePill schema={schema} lang={lang} />
      {showRequired && required ? <span className="text-[11px] font-medium text-red-600">required</span> : null}
      {schema.nullable ? <span className="text-[11px] text-fd-muted-foreground">nullable</span> : null}
      {schema.deprecated ? <span className="text-[11px] text-amber-700">deprecated</span> : null}
    </div>
  );

  const body = (
    <>
      <Constraints schema={schema} />
      {schema.description ? (
        <InlineMarkdown className="schema-field-description mt-1.5 prose-p:!my-0">
          {formatSchemaDescription(schema.description, { lang })}
        </InlineMarkdown>
      ) : null}
      <StructuredContentSchema schema={schema} schemas={schemas} visited={visited} showRequired={showRequired} lang={lang} />
    </>
  );

  if (schema.contentSchema) {
    return (
      <li className="border-b border-[color:var(--fd-border)] py-2.5 last:border-b-0">
        {header}
        {body}
      </li>
    );
  }

  if (!expandable) {
    return (
      <li className="border-b border-[color:var(--fd-border)] py-2.5 last:border-b-0">
        {header}
        {body}
      </li>
    );
  }

  return (
    <li className="border-b border-[color:var(--fd-border)] py-2.5 last:border-b-0">
      <details className="schema-expand-details">
        <ExpandableSummary>
          <span className="min-w-0 flex-1">
            {header}
            {body}
          </span>
        </ExpandableSummary>
        <div className="mt-2 border-l border-[color:var(--fd-border)] pl-3">
          <SchemaView schema={schema} schemas={schemas} visited={visited} showRequired={showRequired} lang={lang} />
        </div>
      </details>
    </li>
  );
}

export function SchemaView({
  schema,
  schemas,
  visited = [],
  showRequired = true,
  lang,
}: {
  schema: ResolvedSchema;
  schemas: SchemaDict;
  visited?: string[];
  showRequired?: boolean;
  lang?: SchemaLabelLang;
}) {
  const { target, cyclic, name } = deref(schema, schemas, visited);

  if (cyclic) {
    return (
      <p className="font-mono text-[12px] text-fd-muted-foreground">
        ↻ {name} <span className="not-italic">（循环引用）</span>
      </p>
    );
  }

  const nextVisited = name ? [...visited, name] : visited;

  // array：展开元素类型
  if (target.type === 'array' && target.items) {
    return (
      <div className="space-y-1.5">
        <p className="text-[12px] text-fd-muted-foreground">
          {lang === 'zh' ? '数组元素' : 'Array items'}
          {shouldShowTypePill(target.items, lang) ? (
            <>
              {' · '}
              <TypePill schema={target.items} lang={lang} />
            </>
          ) : null}
        </p>
        <SchemaView schema={target.items} schemas={schemas} visited={nextVisited} showRequired={showRequired} lang={lang} />
      </div>
    );
  }

  // 组合类型
  if (target.composition && (target.composition.kind === 'oneOf' || target.composition.kind === 'anyOf')) {
    const label =
      lang === 'zh'
        ? target.composition.kind === 'oneOf'
          ? '按事件类型匹配其一'
          : '按事件类型匹配任意'
        : target.composition.kind === 'oneOf'
          ? 'Match one event payload shape'
          : 'Match any event payload shape';
    return (
      <div className="space-y-2">
        <p className="text-[12px] font-medium text-fd-muted-foreground">{label}</p>
        {target.composition.members.map((member, index) => (
          <details key={index} className="schema-expand-details rounded-lg border border-[color:var(--fd-border)] p-2">
            <ExpandableSummary className="mx-0 border-transparent bg-transparent px-0 py-0 shadow-none">
              <span className="min-w-0 flex-1 text-[13px] font-medium text-fd-foreground">
                {optionLabel(index, lang)}
                {shouldShowTypePill(member, lang) ? (
                  <>
                    {' · '}
                    <TypePill schema={member} lang={lang} />
                  </>
                ) : null}
              </span>
            </ExpandableSummary>
            <div className="mt-2">
              <SchemaView schema={member} schemas={schemas} visited={nextVisited} showRequired={showRequired} lang={lang} />
            </div>
          </details>
        ))}
      </div>
    );
  }

  // object：渲染前合并 allOf 命名引用与内联成员，避免公共 envelope 字段被隐藏。
  const objectView = collectObjectView(target, schemas, nextVisited);
  if (objectView) {
    const { properties, required } = objectView;
    return (
      <div>
        <ul className="m-0 list-none p-0">
          {orderedPropertyEntries(properties, required).map(([propName, propSchema]) => (
            <PropertyRow
              key={propName}
              name={propName}
              schema={propSchema}
              required={required.has(propName)}
              schemas={schemas}
              visited={nextVisited}
              showRequired={showRequired}
              lang={lang}
            />
          ))}
        </ul>
      </div>
    );
  }

  // 标量 / 兜底
  return (
    <div className={cn('text-[13px]')}>
      <TypePill schema={target} lang={lang} />
      <Constraints schema={target} />
      {target.description ? (
        <p className="schema-field-description mt-1.5 leading-6">
          {formatSchemaDescription(target.description, { lang })}
        </p>
      ) : null}
    </div>
  );
}
