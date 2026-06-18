/**
 * Minimal, dependency-free POSIX path helpers (Story 9.5).
 *
 * The filesystem repositories and the desktop fs adapter must bundle into the
 * Tauri webview, which has no `node:path`. These pure-string helpers replace the
 * handful of `path.*` operations those modules need. Anydocs project paths are
 * POSIX-shaped internally (forward-slash slugs); desktop targets are macOS/Linux.
 *
 * Caveat: this is POSIX-only. On a Windows *server* these differ from `node:path`
 * (backslash separators). Acceptable for the current pre-ship phase (macOS/Linux
 * dev + desktop); server-only modules that need OS-native paths keep `node:path`.
 */

const SEP = '/';

/** Join segments with single separators, dropping empty parts. */
export function joinPosix(...segments: string[]): string {
  const parts: string[] = [];
  for (const segment of segments) {
    if (!segment) continue;
    for (const piece of segment.split(SEP)) {
      if (piece) parts.push(piece);
    }
  }
  const joined = parts.join(SEP);
  return segments[0]?.startsWith(SEP) ? SEP + joined : joined;
}

/** Directory portion of a path (no trailing slash; `.` when none). */
export function dirnamePosix(p: string): string {
  const normalized = p.endsWith(SEP) ? p.slice(0, -1) : p;
  const idx = normalized.lastIndexOf(SEP);
  if (idx < 0) return '.';
  if (idx === 0) return SEP;
  return normalized.slice(0, idx);
}

/** Final path segment. */
export function basenamePosix(p: string): string {
  const normalized = p.endsWith(SEP) ? p.slice(0, -1) : p;
  const idx = normalized.lastIndexOf(SEP);
  return idx < 0 ? normalized : normalized.slice(idx + 1);
}

/** Whether a path is absolute (POSIX: starts with `/`). */
export function isAbsolutePosix(p: string): boolean {
  return p.startsWith(SEP);
}

/** Relative path from `from` to `to` (both absolute POSIX paths). */
export function relativePosix(from: string, to: string): string {
  const fromParts = from.split(SEP).filter(Boolean);
  const toParts = to.split(SEP).filter(Boolean);
  let i = 0;
  while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) {
    i += 1;
  }
  const up = fromParts.slice(i).map(() => '..');
  const down = toParts.slice(i);
  return [...up, ...down].join(SEP);
}
