import type { ResolvedSchema } from '@anydocs/core';

import { cn } from '@/lib/utils';
import { schemaTypeLabel } from '@/components/docs/openapi/schema-format';

type SchemaDict = Record<string, ResolvedSchema>;

function isExpandable(schema: ResolvedSchema | undefined): boolean {
  if (!schema) {
    return false;
  }
  if (schema.ref || schema.composition || schema.properties) {
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

function TypePill({ schema }: { schema: ResolvedSchema | undefined }) {
  return (
    <code className="rounded bg-[color:var(--fd-muted,rgba(0,0,0,0.04))] px-1.5 py-0.5 font-mono text-[12px] text-fd-foreground">
      {schemaTypeLabel(schema)}
    </code>
  );
}

function Constraints({ schema }: { schema: ResolvedSchema }) {
  const bits: string[] = [];
  if (schema.enum && schema.enum.length > 0) {
    bits.push(`enum: ${schema.enum.map((value) => JSON.stringify(value)).join(', ')}`);
  }
  if (schema.default !== undefined) {
    bits.push(`default: ${JSON.stringify(schema.default)}`);
  }
  if (schema.format) {
    bits.push(`format: ${schema.format}`);
  }
  if (bits.length === 0) {
    return null;
  }
  return <div className="mt-1 font-mono text-[11px] text-fd-muted-foreground">{bits.join(' · ')}</div>;
}

function PropertyRow({
  name,
  schema,
  required,
  schemas,
  visited,
}: {
  name: string;
  schema: ResolvedSchema;
  required: boolean;
  schemas: SchemaDict;
  visited: string[];
}) {
  const expandable = isExpandable(schema);

  const header = (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <code className="font-mono text-[13px] font-semibold text-fd-foreground">{name}</code>
      <TypePill schema={schema} />
      {required ? <span className="text-[11px] font-medium text-red-600">required</span> : null}
      {schema.nullable ? <span className="text-[11px] text-fd-muted-foreground">nullable</span> : null}
      {schema.deprecated ? <span className="text-[11px] text-amber-700">deprecated</span> : null}
    </div>
  );

  const body = (
    <>
      {schema.description ? (
        <p className="mt-1 text-[13px] leading-6 text-[color:var(--docs-body-copy,var(--fd-muted-foreground))]">{schema.description}</p>
      ) : null}
      <Constraints schema={schema} />
    </>
  );

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
      <details className="group">
        <summary className="flex cursor-pointer list-none items-start gap-2">
          <span className="mt-1 text-fd-muted-foreground transition-transform group-open:rotate-90">▸</span>
          <span className="min-w-0 flex-1">
            {header}
            {body}
          </span>
        </summary>
        <div className="mt-2 border-l border-[color:var(--fd-border)] pl-3">
          <SchemaView schema={schema} schemas={schemas} visited={visited} />
        </div>
      </details>
    </li>
  );
}

export function SchemaView({
  schema,
  schemas,
  visited = [],
}: {
  schema: ResolvedSchema;
  schemas: SchemaDict;
  visited?: string[];
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
        <p className="text-[12px] text-fd-muted-foreground">数组元素 · <TypePill schema={target.items} /></p>
        <SchemaView schema={target.items} schemas={schemas} visited={nextVisited} />
      </div>
    );
  }

  // 组合类型
  if (target.composition && (target.composition.kind === 'oneOf' || target.composition.kind === 'anyOf')) {
    const label = target.composition.kind === 'oneOf' ? '满足其一（oneOf）' : '满足任意（anyOf）';
    return (
      <div className="space-y-2">
        <p className="text-[12px] font-medium text-fd-muted-foreground">{label}</p>
        {target.composition.members.map((member, index) => (
          <details key={index} className="group rounded-md border border-[color:var(--fd-border)] p-2">
            <summary className="cursor-pointer list-none text-[13px] font-medium text-fd-foreground">
              选项 {index + 1} · <TypePill schema={member} />
            </summary>
            <div className="mt-2">
              <SchemaView schema={member} schemas={schemas} visited={nextVisited} />
            </div>
          </details>
        ))}
      </div>
    );
  }

  // object（含 allOf 已合并的 properties）
  const properties = target.properties;
  if (properties && Object.keys(properties).length > 0) {
    const required = new Set(target.required ?? []);
    const inheritedRefs = (target.composition?.members ?? []).filter((member) => member.ref).map((member) => member.ref!);
    return (
      <div>
        {inheritedRefs.length > 0 ? (
          <p className="mb-1.5 text-[12px] text-fd-muted-foreground">继承自：{inheritedRefs.join('、')}</p>
        ) : null}
        <ul className="m-0 list-none p-0">
          {Object.entries(properties).map(([propName, propSchema]) => (
            <PropertyRow
              key={propName}
              name={propName}
              schema={propSchema}
              required={required.has(propName)}
              schemas={schemas}
              visited={nextVisited}
            />
          ))}
        </ul>
      </div>
    );
  }

  // 标量 / 兜底
  return (
    <div className={cn('text-[13px]')}>
      <TypePill schema={target} />
      {target.description ? (
        <p className="mt-1 leading-6 text-[color:var(--docs-body-copy,var(--fd-muted-foreground))]">{target.description}</p>
      ) : null}
      <Constraints schema={target} />
    </div>
  );
}
