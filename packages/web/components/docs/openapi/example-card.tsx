'use client';

import { formatExampleValue } from '@/components/docs/openapi/schema-format';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type ExampleItem = {
  id: string;
  label: string;
  context?: string;
  description?: string;
  value: unknown;
};

export function ExampleCard({ title, items }: { title: string; items: ExampleItem[] }) {
  if (items.length === 0) {
    return null;
  }

  const renderExample = (item: ExampleItem) => (
    <div className="space-y-2 p-4">
      <p className="font-mono text-[11px] text-slate-400">{item.context ?? item.label}</p>
      {item.description ? <p className="text-[12px] leading-5 text-slate-300">{item.description}</p> : null}
      <pre className="overflow-x-auto font-mono text-[12px] leading-5 text-slate-100">
        {formatExampleValue(item.value)}
      </pre>
    </div>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--fd-border)] bg-[#0f172a] shadow-sm">
      <div className="border-b border-white/10 px-4 py-2.5 text-[12px] font-semibold text-slate-200">{title}</div>
      {items.length > 1 ? (
        <Tabs defaultValue={items[0]!.id}>
          <TabsList
            aria-label={title}
            className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-0 border-b border-white/10 bg-transparent px-3 py-2"
          >
            {items.map((item) => (
              <TabsTrigger
                key={item.id}
                value={item.id}
                className="shrink-0 px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-white/10 hover:text-white data-[state=active]:bg-white data-[state=active]:text-slate-950"
              >
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {items.map((item) => (
            <TabsContent key={item.id} value={item.id} className="mt-0 focus-visible:ring-inset">
              {renderExample(item)}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        renderExample(items[0]!)
      )}
    </div>
  );
}
