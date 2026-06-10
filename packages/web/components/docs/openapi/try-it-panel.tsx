'use client';

import { useMemo, useState } from 'react';

import type { OpenApiOperation, ResolvedSchema, TryItAuth } from '@anydocs/core';

import { synthesizeExample } from '@/components/docs/openapi/schema-example';
import { cn } from '@/lib/utils';
import type { DocsLang } from '@/lib/docs/types';

type SchemaDict = Record<string, ResolvedSchema>;

type InvokeResult =
  | { ok: true; status: number; statusText: string; headers: Record<string, string>; body: unknown; durationMs: number }
  | { ok: false; error: { code: string; message: string } };

function stringifyInitialValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

export function TryItPanel({
  lang,
  sourceId,
  operation,
  schemas,
  auth,
}: {
  lang: DocsLang;
  sourceId: string;
  operation: OpenApiOperation;
  schemas: SchemaDict;
  auth: TryItAuth;
}) {
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);

  const initialParams = useMemo(() => {
    const map: Record<string, string> = {};
    for (const param of operation.parameters) {
      map[`${param.in}:${param.name}`] = stringifyInitialValue(param.example ?? synthesizeExample(param.schema, schemas));
    }
    return map;
  }, [operation, schemas]);

  const initialBody = useMemo(() => {
    const content = operation.requestBody?.contents?.[0];
    if (!content?.schema) return '';
    const example = content.example ?? synthesizeExample(content.schema, schemas);
    return example === undefined ? '' : JSON.stringify(example, null, 2);
  }, [operation, schemas]);

  const [params, setParams] = useState<Record<string, string>>(initialParams);
  const [bodyText, setBodyText] = useState(initialBody);
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [result, setResult] = useState<InvokeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const setParam = (key: string, value: string) => setParams((prev) => ({ ...prev, [key]: value }));
  const setCred = (key: string, value: string) => setCreds((prev) => ({ ...prev, [key]: value }));

  async function send() {
    setClientError(null);
    setResult(null);

    const pathParams: Record<string, string> = {};
    const query: Record<string, string> = {};
    const headers: Record<string, string> = {};
    for (const param of operation.parameters) {
      const value = params[`${param.in}:${param.name}`] ?? '';
      if (value === '') continue;
      if (param.in === 'path') pathParams[param.name] = value;
      else if (param.in === 'query') query[param.name] = value;
      else if (param.in === 'header') headers[param.name] = value;
    }

    let parsedBody: unknown;
    if (operation.requestBody && bodyText.trim()) {
      try {
        parsedBody = JSON.parse(bodyText);
      } catch {
        setClientError(t('请求体不是合法 JSON', 'Request body is not valid JSON'));
        return;
      }
    }

    setLoading(true);
    try {
      const response = await fetch('/try-it/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lang,
          sourceId,
          operationId: operation.id,
          method: operation.method,
          path: operation.path,
          pathParams,
          query,
          headers,
          body: parsedBody,
          credentials: creds,
        }),
      });
      setResult((await response.json()) as InvokeResult);
    } catch (error) {
      setClientError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    'w-full rounded-md border border-[color:var(--fd-border)] bg-[color:var(--fd-background,white)] px-2.5 py-1.5 font-mono text-[12px] text-fd-foreground focus:outline-none focus:ring-1 focus:ring-[color:var(--fd-ring,var(--fd-primary))]';
  const labelClass = 'text-[12px] font-medium text-fd-foreground';

  return (
    <section className="rounded-xl border border-[color:var(--fd-border)] bg-[color:var(--fd-card,white)] p-4 shadow-sm">
      <h2 className="mb-3 text-[15px] font-semibold text-fd-foreground">{t('在线测试', 'Try it')}</h2>

      {/* 鉴权输入：仅内置 apiKey/bearer/basic 显示；signed 走服务端，none 无 */}
      {auth.type === 'apiKey' ? (
        <div className="mb-3 space-y-1">
          <label className={labelClass}>{auth.name} (API Key)</label>
          <input className={inputClass} value={creds.apiKey ?? ''} onChange={(e) => setCred('apiKey', e.target.value)} />
        </div>
      ) : null}
      {auth.type === 'bearer' ? (
        <div className="mb-3 space-y-1">
          <label className={labelClass}>Bearer Token</label>
          <input className={inputClass} value={creds.token ?? ''} onChange={(e) => setCred('token', e.target.value)} />
        </div>
      ) : null}
      {auth.type === 'basic' ? (
        <div className="mb-3 grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className={labelClass}>Username</label>
            <input className={inputClass} value={creds.username ?? ''} onChange={(e) => setCred('username', e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Password</label>
            <input type="password" className={inputClass} value={creds.password ?? ''} onChange={(e) => setCred('password', e.target.value)} />
          </div>
        </div>
      ) : null}
      {auth.type === 'signed' ? (
        <p className="mb-3 text-[12px] text-fd-muted-foreground">
          {t('该接口由服务端签名，无需在此填写密钥。', 'This endpoint is signed server-side; no key needed here.')}
        </p>
      ) : null}

      {operation.parameters.length > 0 ? (
        <div className="mb-3 space-y-2">
          {operation.parameters.map((param) => {
            const key = `${param.in}:${param.name}`;
            return (
              <div key={key} className="space-y-1">
                <label className={labelClass}>
                  <span className="font-mono">{param.name}</span>
                  <span className="ml-1 text-fd-muted-foreground">({param.in})</span>
                  {param.required ? <span className="ml-1 text-red-600">*</span> : null}
                </label>
                <input className={inputClass} value={params[key] ?? ''} onChange={(e) => setParam(key, e.target.value)} />
              </div>
            );
          })}
        </div>
      ) : null}

      {operation.requestBody ? (
        <div className="mb-3 space-y-1">
          <label className={labelClass}>{t('请求体 (JSON)', 'Request body (JSON)')}</label>
          <textarea
            className={cn(inputClass, 'min-h-[160px] leading-5')}
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            spellCheck={false}
          />
        </div>
      ) : null}

      <button
        type="button"
        onClick={send}
        disabled={loading}
        className="inline-flex items-center rounded-lg bg-fd-foreground px-3.5 py-1.5 text-[13px] font-medium text-fd-background transition hover:opacity-90 disabled:opacity-50"
      >
        {loading ? t('发送中…', 'Sending…') : t('发送请求', 'Send')}
      </button>

      {clientError ? <p className="mt-2 text-[12px] text-red-600">{clientError}</p> : null}

      {result ? (
        <div className="mt-4 overflow-hidden rounded-lg border border-[color:var(--fd-border)] bg-[#0f172a]">
          <div className="border-b border-white/10 px-3 py-2 text-[12px] font-medium text-slate-200">
            {result.ok ? (
              <span>
                {result.status} {result.statusText} · {result.durationMs}ms
              </span>
            ) : (
              <span className="text-red-300">
                {result.error.code}: {result.error.message}
              </span>
            )}
          </div>
          {result.ok ? (
            <pre className="max-h-[360px] overflow-auto p-3 font-mono text-[12px] leading-5 text-slate-100">
              {typeof result.body === 'string' ? result.body : JSON.stringify(result.body, null, 2)}
            </pre>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
