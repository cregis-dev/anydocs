'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import { Check, ChevronUp } from 'lucide-react';

type Lang = 'zh' | 'en';

function detectLang(pathname: string): Lang {
  if (pathname.startsWith('/en/')) return 'en';
  return 'zh';
}

function getTargetPath(pathname: string, target: Lang): string {
  const normalized = pathname.startsWith('/docs')
    ? pathname.replace(/^\/docs(\/|$)/, '/zh$1')
    : pathname;

  if (normalized.startsWith('/zh/')) return normalized.replace(/^\/zh\//, `/${target}/`);
  if (normalized.startsWith('/en/')) return normalized.replace(/^\/en\//, `/${target}/`);
  if (normalized === '/zh' || normalized === '/en') return `/${target}`;
  return `/${target}`;
}

export function LangThemeDock() {
  const router = useRouter();
  const pathname = usePathname() || '/';

  const lang = useMemo(() => detectLang(pathname), [pathname]);

  const [open, setOpen] = useState(false);
  const pillRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(
    null,
  );

  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  function updateMenuPos() {
    const pill = pillRef.current;
    if (!pill) return;
    const rect = pill.getBoundingClientRect();
    setMenuPos({ left: rect.left, top: rect.top - 8 });
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        setMenuPos(null);
      }
    }

    function onPointerDown(e: PointerEvent) {
      if (!open) return;
      const target = e.target;
      if (!(target instanceof Node)) return;

      const pill = pillRef.current;
      if (pill && pill.contains(target)) return;

      const menu = menuRef.current;
      if (menu && menu.contains(target)) return;

      setOpen(false);
      setMenuPos(null);
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    window.addEventListener('resize', updateMenuPos);
    window.addEventListener('scroll', updateMenuPos, true);
    return () => {
      window.removeEventListener('resize', updateMenuPos);
      window.removeEventListener('scroll', updateMenuPos, true);
    };
  }, [open]);

  const languages = useMemo(
    () =>
      [
        { id: 'en' as const, label: 'English', flag: '🇺🇸' },
        { id: 'zh' as const, label: '简体中文', flag: '🇨🇳' },
      ] satisfies Array<{ id: Lang; label: string; flag: string }>,
    [],
  );

  const current = languages.find((l) => l.id === lang) ?? languages[0];

  const isClient = typeof window !== 'undefined';

  return (
    <div className="relative" suppressHydrationWarning>
      {isClient && open && menuPos
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[2000]"
              style={{ left: menuPos.left, top: menuPos.top }}
            >
              <div className="absolute bottom-full left-0 mb-2 w-64 overflow-hidden rounded-lg border border-fd-border bg-[color:var(--cregis-surface)] shadow-[0_18px_48px_rgba(0,0,0,0.18)]">
                {languages.map((item) => {
                  const selected = item.id === lang;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        const target = getTargetPath(pathname, item.id);
                        setOpen(false);
                        setMenuPos(null);
                        router.push(target);
                      }}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-[color:var(--cregis-hover)]"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span aria-hidden className="text-base">
                          {item.flag}
                        </span>
                        <span className={selected ? 'truncate text-fd-primary' : 'truncate'}>
                          {item.label}
                        </span>
                      </span>
                      {selected ? <Check className="size-4" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body,
          )
        : null}

      <div className="flex items-center gap-2">
        <button
          ref={pillRef}
          type="button"
          onClick={() => {
            setOpen((v) => {
              const next = !v;
              if (next) updateMenuPos();
              else setMenuPos(null);
              return next;
            });
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-[color:var(--cregis-muted)] px-3 py-2 text-sm font-medium text-fd-foreground shadow-sm"
          aria-expanded={open}
          aria-haspopup="menu"
        >
          <span aria-hidden className="text-base">
            {current.flag}
          </span>
          <span>{current.label}</span>
          <ChevronUp className={`size-4 transition ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
    </div>
  );
}
