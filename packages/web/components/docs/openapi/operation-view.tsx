import type { OpenApiOperation, ResolvedMediaType, ResolvedSchema, TryItConfig } from '@anydocs/core';

import { InlineMarkdown } from '@/components/docs/openapi/inline-markdown';
import { TryItPanel } from '@/components/docs/openapi/try-it-panel';
import { MethodBadge } from '@/components/docs/openapi/method-badge';
import { ParamTable } from '@/components/docs/openapi/param-table';
import { SchemaView } from '@/components/docs/openapi/schema-view';
import { formatExampleValue } from '@/components/docs/openapi/schema-format';
import { synthesizeExample } from '@/components/docs/openapi/schema-example';
import type { DocsLang } from '@/lib/docs/types';

type SchemaDict = Record<string, ResolvedSchema>;
type ExampleItem = { label: string; value: unknown };

function MediaSchemas({ contents, schemas }: { contents: ResolvedMediaType[]; schemas: SchemaDict }) {
  const withSchema = contents.filter((content) => content.schema);
  if (withSchema.length === 0) {
    return null;
  }
  return (
    <div className="space-y-3">
      {withSchema.map((content, index) => (
        <div key={`${content.mediaType}:${index}`} className="space-y-1.5">
          <code className="font-mono text-[11px] text-fd-muted-foreground">{content.mediaType}</code>
          <div className="rounded-lg border border-[color:var(--fd-border)] p-3">
            <SchemaView schema={content.schema!} schemas={schemas} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-fd-foreground">{title}</h2>
      {children}
    </section>
  );
}

function ExampleCard({ title, items }: { title: string; items: ExampleItem[] }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--fd-border)] bg-[#0f172a] shadow-sm">
      <div className="border-b border-white/10 px-4 py-2.5 text-[12px] font-semibold text-slate-200">{title}</div>
      <div className="space-y-3 p-4">
        {items.map((item, index) => (
          <div key={index} className="space-y-1">
            <p className="font-mono text-[11px] text-slate-400">{item.label}</p>
            <pre className="overflow-x-auto font-mono text-[12px] leading-5 text-slate-100">
              {formatExampleValue(item.value)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}

function collectExamples(
  operation: OpenApiOperation,
  schemas: SchemaDict,
): { request: ExampleItem[]; responses: ExampleItem[] } {
  // 优先用 media 级显式 example，否则从 schema 合成示例 JSON。
  const exampleFor = (content: ResolvedMediaType): unknown =>
    content.example !== undefined ? content.example : synthesizeExample(content.schema, schemas);

  const request = (operation.requestBody?.contents ?? [])
    .map((content) => ({ label: content.mediaType, value: exampleFor(content) }))
    .filter((item) => item.value !== null && item.value !== undefined);
  const responses = operation.responses
    .flatMap((response) =>
      response.contents.map((content) => ({
        label: `${response.status} · ${content.mediaType}`,
        value: exampleFor(content),
      })),
    )
    .filter((item) => item.value !== null && item.value !== undefined);
  return { request, responses };
}

export function OperationView({
  operation,
  schemas,
  lang,
  tryIt,
  sourceId,
}: {
  operation: OpenApiOperation;
  schemas: SchemaDict;
  lang: DocsLang;
  tryIt?: TryItConfig;
  sourceId?: string;
}) {
  const pathParams = operation.parameters.filter((param) => param.in === 'path');
  const queryParams = operation.parameters.filter((param) => param.in === 'query');
  const headerParams = operation.parameters.filter((param) => param.in === 'header');

  const { request: requestExamples, responses: responseExamples } = collectExamples(operation, schemas);
  const hasExamples = requestExamples.length > 0 || responseExamples.length > 0;
  // 仅可调用接口（非 webhook）且配置开启时显示 Try-it
  const showTryIt = Boolean(tryIt?.enabled) && operation.kind === 'endpoint' && Boolean(sourceId);
  const showColumns = hasExamples || showTryIt;

  const main = (
    <div className="min-w-0 space-y-8 xl:flex-1">
      {operation.description ? <InlineMarkdown>{operation.description}</InlineMarkdown> : null}

      {operation.parameters.length > 0 ? (
        <Section title={lang === 'zh' ? '参数' : 'Parameters'}>
          <ParamTable title={lang === 'zh' ? '路径参数' : 'Path'} params={pathParams} />
          <ParamTable title={lang === 'zh' ? '查询参数' : 'Query'} params={queryParams} />
          <ParamTable title={lang === 'zh' ? '请求头' : 'Headers'} params={headerParams} />
        </Section>
      ) : null}

      {operation.requestBody ? (
        <Section title={lang === 'zh' ? '请求体' : 'Request Body'}>
          {operation.requestBody.required ? (
            <p className="text-[12px] font-medium text-red-600">required</p>
          ) : null}
          {operation.requestBody.description ? (
            <InlineMarkdown>{operation.requestBody.description}</InlineMarkdown>
          ) : null}
          <MediaSchemas contents={operation.requestBody.contents} schemas={schemas} />
        </Section>
      ) : null}

      {operation.responses.length > 0 ? (
        <Section title={lang === 'zh' ? '响应' : 'Responses'}>
          <div className="space-y-4">
            {operation.responses.map((response) => (
              <div key={response.status} className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <code className="font-mono text-[14px] font-semibold text-fd-foreground">{response.status}</code>
                  {response.description ? (
                    <span className="text-[13px] text-fd-muted-foreground">{response.description}</span>
                  ) : null}
                </div>
                <MediaSchemas contents={response.contents} schemas={schemas} />
              </div>
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );

  const aside = showColumns ? (
    <aside className="mt-8 space-y-4 xl:mt-0 xl:w-[400px] xl:shrink-0 xl:sticky xl:top-24 xl:h-fit">
      {showTryIt && sourceId ? (
        <TryItPanel
          lang={lang}
          sourceId={sourceId}
          operation={operation}
          schemas={schemas}
          auth={tryIt?.auth ?? { type: 'none' }}
        />
      ) : null}
      <ExampleCard title={lang === 'zh' ? '请求示例' : 'Request example'} items={requestExamples} />
      <ExampleCard title={lang === 'zh' ? '响应示例' : 'Response example'} items={responseExamples} />
    </aside>
  ) : null;

  return (
    <article className="space-y-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <MethodBadge method={operation.method} />
          <code className="font-mono text-[14px] text-fd-foreground">{operation.path}</code>
          {operation.kind === 'webhook' ? (
            <span className="rounded-md bg-purple-50 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-purple-700 ring-1 ring-inset ring-purple-600/20">
              Webhook
            </span>
          ) : null}
          {operation.deprecated ? (
            <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold uppercase text-amber-700 ring-1 ring-inset ring-amber-600/20">
              Deprecated
            </span>
          ) : null}
        </div>
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] text-fd-foreground">{operation.summary}</h1>
        {operation.kind === 'webhook' ? (
          <p className="text-[13px] text-fd-muted-foreground">
            {lang === 'zh'
              ? '由服务端主动推送的回调通知，需在你的服务实现接收端点。'
              : 'A server-initiated callback. Implement a receiving endpoint in your service.'}
          </p>
        ) : null}
      </header>

      {showColumns ? (
        <div className="xl:flex xl:items-start xl:gap-8">
          {main}
          {aside}
        </div>
      ) : (
        main
      )}
    </article>
  );
}
