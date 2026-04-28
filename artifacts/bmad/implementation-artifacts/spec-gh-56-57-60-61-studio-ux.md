---
title: 'Studio UX: sidebar delete, URL deep linking, status indicators, validation badge'
type: 'feature'
created: '2026-04-27'
status: 'done'
route: 'one-shot'
---

# Studio UX: sidebar delete, URL deep linking, status indicators, validation badge

## Intent

Four related Studio UX improvements resolved in a single PR:

- **#56** — Page delete from sidebar nav menu (was only accessible via settings panel)
- **#57** — URL deep linking: `?page=<id>` synced to address bar; restored on reload
- **#60** — Page status visible in nav tree via icon color (amber=draft, blue=in_review, muted=published)
- **#61** — Validation issues count badge in footer status bar

## Suggested Review Order

1. [packages/web/components/studio/navigation-tree.tsx](../../packages/web/components/studio/navigation-tree.tsx) — `Trash2` icon, `onDeletePage` prop, status icon color, Delete menu item
2. [packages/web/components/studio/navigation-composer.tsx](../../packages/web/components/studio/navigation-composer.tsx) — `onDeletePage` prop passthrough to `NavigationTree`
3. [packages/web/components/studio/local-studio-app.tsx](../../packages/web/components/studio/local-studio-app.tsx) — `onDeletePageById` callback, URL `?page=<id>` sync, `pendingPageIdFromUrlRef`, validation badge with `AlertTriangle`
