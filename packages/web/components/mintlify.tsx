import type { ReactNode } from 'react';
import { Code, Palette, Stars, Wrench } from 'lucide-react';

function Icon({ name }: { name?: string }) {
  if (!name) return null;

  const props = { className: 'size-4 text-zinc-600' };
  switch (name) {
    case 'palette':
      return <Palette {...props} />;
    case 'code':
      return <Code {...props} />;
    case 'screwdriver-wrench':
      return <Wrench {...props} />;
    case 'stars':
      return <Stars {...props} />;
    default:
      return null;
  }
}

export function CardGroup({
  cols,
  children,
}: {
  cols?: number;
  children: ReactNode;
}) {
  const colClass =
    cols === 4
      ? 'md:grid-cols-4'
      : cols === 3
        ? 'md:grid-cols-3'
        : cols === 2
          ? 'md:grid-cols-2'
          : 'md:grid-cols-2';

  return <div className={`grid gap-4 ${colClass}`}>{children}</div>;
}

export function Card({
  title,
  icon,
  children,
}: {
  title?: string;
  icon?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icon ? <Icon name={icon} /> : null}</div>
        <div className="min-w-0">
          {title ? (
            <div className="text-sm font-semibold text-zinc-900">{title}</div>
          ) : null}
          <div className="mt-1 text-sm leading-6 text-zinc-600">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function Info({ children }: { children: ReactNode }) {
  return (
    <div className="my-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-950">
      {children}
    </div>
  );
}

