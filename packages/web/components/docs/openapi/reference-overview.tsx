import Link from 'next/link';

import type { OpenApiDocArtifact, OpenApiServer } from '@anydocs/core';

import { MethodBadge } from '@/components/docs/openapi/method-badge';
import type { DocsLang } from '@/lib/docs/types';

function ServerPanel({ server }: { server: OpenApiServer }) {
  const variables = server.variables ? Object.entries(server.variables) : [];
  return (
    <div className="rounded-lg border border-[color:var(--fd-border)] bg-[color:var(--fd-card,white)] p-4">
      <code className="break-all font-mono text-[13px] text-fd-foreground">{server.url}</code>
      {server.description ? (
        <p className="mt-1.5 text-[12px] leading-5 text-fd-muted-foreground">{server.description}</p>
      ) : null}
      {variables.length > 0 ? (
        <dl className="mt-2 space-y-1">
          {variables.map(([name, variable]) => (
            <div key={name} className="flex flex-wrap gap-x-2 text-[12px]">
              <dt className="font-mono font-medium text-fd-foreground">{name}</dt>
              <dd className="font-mono text-fd-muted-foreground">= {variable.default}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

export function ReferenceOverview({ doc, lang }: { doc: OpenApiDocArtifact; lang: DocsLang }) {
  return (
    <div className="min-w-0 space-y-10">
      <header className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fd-muted-foreground">
          {lang === 'zh' ? 'API 参考' : 'API Reference'}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[34px] font-semibold leading-tight tracking-[-0.03em] text-fd-foreground">
            {doc.info.title}
          </h1>
          {doc.info.version ? (
            <span className="rounded-md bg-[color:var(--fd-muted,rgba(0,0,0,0.05))] px-2 py-0.5 font-mono text-[12px] text-fd-muted-foreground">
              v{doc.info.version}
            </span>
          ) : null}
        </div>
        {doc.info.description ? (
          <p className="max-w-[720px] whitespace-pre-line text-[15px] leading-7 text-[color:var(--docs-body-copy,var(--fd-muted-foreground))]">
            {doc.info.description}
          </p>
        ) : null}
      </header>

      {doc.servers.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-[15px] font-semibold text-fd-foreground">Server</h2>
          <div className="space-y-2">
            {doc.servers.map((server, index) => (
              <ServerPanel key={index} server={server} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-6">
        {doc.nav.map((group) => (
          <div key={group.tag} className="space-y-3">
            <div className="space-y-1">
              <h2 className="text-[15px] font-semibold text-fd-foreground">{group.tag}</h2>
              {group.description ? (
                <p className="text-[13px] text-fd-muted-foreground">{group.description}</p>
              ) : null}
            </div>
            <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
              {group.items.map((item) => (
                <li key={item.operationId}>
                  <Link
                    href={item.href}
                    className="flex flex-col gap-1.5 rounded-lg border border-[color:var(--fd-border)] bg-[color:var(--fd-card,white)] p-3 transition hover:border-fd-foreground/20 hover:shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      <MethodBadge method={item.kind === 'webhook' ? 'WEBHOOK' : item.method} />
                      {item.kind !== 'webhook' ? (
                        <code className="min-w-0 truncate font-mono text-[12px] text-fd-muted-foreground">{item.path}</code>
                      ) : null}
                    </div>
                    <span className="text-[14px] font-medium text-fd-foreground">{item.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
