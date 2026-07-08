import type { ResolvedParameter } from '@anydocs/core';

import { InlineMarkdown } from '@/components/docs/openapi/inline-markdown';
import { schemaTypeLabel } from '@/components/docs/openapi/schema-format';

export function ParamTable({ title, params }: { title: string; params: ResolvedParameter[] }) {
  if (params.length === 0) {
    return null;
  }

  return (
    <section className="space-y-2">
      <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-fd-foreground">{title}</h3>
      <ul className="m-0 list-none rounded-lg border border-[color:var(--fd-border)] p-0">
        {params.map((param) => (
          <li key={`${param.in}:${param.name}`} className="border-b border-[color:var(--fd-border)] px-3 py-2.5 last:border-b-0">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <code className="font-mono text-[13px] font-semibold text-fd-foreground">{param.name}</code>
              <code className="rounded bg-[color:var(--fd-muted,rgba(0,0,0,0.04))] px-1.5 py-0.5 font-mono text-[12px] text-fd-foreground">
                {schemaTypeLabel(param.schema)}
              </code>
              {param.required ? <span className="text-[11px] font-medium text-red-600">required</span> : null}
              {param.deprecated ? <span className="text-[11px] text-amber-700">deprecated</span> : null}
            </div>
            {param.description ? (
              <InlineMarkdown className="mt-1 prose-p:!my-0 prose-p:!text-[13px] prose-p:!leading-6">
                {param.description}
              </InlineMarkdown>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
