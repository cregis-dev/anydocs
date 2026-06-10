import { cn } from '@/lib/utils';

const METHOD_STYLES: Record<string, string> = {
  GET: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  POST: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  PUT: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  PATCH: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  DELETE: 'bg-red-50 text-red-700 ring-red-600/20',
};

const DEFAULT_STYLE = 'bg-slate-100 text-slate-600 ring-slate-500/20';

export function MethodBadge({ method, className }: { method: string; className?: string }) {
  const upper = method.toUpperCase();
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold uppercase leading-none tracking-wide ring-1 ring-inset',
        METHOD_STYLES[upper] ?? DEFAULT_STYLE,
        className,
      )}
    >
      {upper}
    </span>
  );
}
