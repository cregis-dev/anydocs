/**
 * Node-free filesystem surface for the desktop renderer (Tauri webview).
 *
 * Story 9.5: the Tauri webview has no `node:fs`/`node:path`, and the main
 * `@anydocs/core` barrel pulls server-only services (build/preview/init). The
 * renderer imports THIS narrow entry instead — its transitive graph contains no
 * node built-ins (enforced by a guard test). Pair with `createDesktopFsPort`
 * (from here) to back the repositories with native Tauri fs commands.
 *
 * Type-only imports (PageDoc, NavigationDoc, DocsLang, …) may still come from
 * the main barrel — they are erased at compile time and pull no runtime code.
 */
export * from './fs/docs-repository.ts';
export * from './fs/api-source-repository.ts';
export * from './fs/desktop-fs-adapter.ts';
export * from './fs/file-system-port.ts';
export * from './errors/fs-error.ts';
export * from './utils/posix-path.ts';
