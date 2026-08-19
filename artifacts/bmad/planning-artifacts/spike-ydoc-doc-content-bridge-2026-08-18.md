# Spike — Y.Doc ↔ `doc-content-v1` bridge

_Date: 2026-08-18 · Team First strategy, action 3 · Status: **complete — GREEN LIGHT**_

## Question

The architecture commits to "`doc-content-v1` canonical at rest ↔ CRDT document in flight",
and the cloud sprint flags this as *spike EARLY, before C3 + C6*. Two things had to be proven
before C2.6 (autosave) and C6.1 (realtime sync) are designed:

1. Does a document survive `doc-content-v1 → Plate → Y.Doc → Plate → doc-content-v1` without loss?
2. Do concurrent edits (a human and an agent) converge, and does the server agree?

## Verdict

**Both yes.** The bridge is viable as specified; no architecture change is needed.

Evidence is executable and kept as a regression test, not discarded with the spike:
`packages/cloud-realtime/tests/ydoc-bridge-spike.test.ts` (5/5 passing).

| Check | Result |
|---|---|
| All 19 real `doc-content-v1` fixtures round-trip through a Y.Doc | **19/19 lossless** |
| Y.Doc leg adds loss beyond the plain Plate round trip | **none** — identical results |
| Concurrent human + agent edits converge | **yes** — both edits survive, order sane (`HUMAN, A, B, AGENT`) |
| Server-side persisted document matches clients | **yes** |

Fixtures cover all 11 canonical block types plus marks, links, nested/ordered/todo lists,
tables with headers, code blocks with language+title, code groups, callouts and mermaid.

## Findings that change how stories are built

### 1. Key order is NOT preserved — autosave must compare structurally

The bridge round-trips the same *data* but not the same *key order*. `JSON.stringify(before) ===
JSON.stringify(after)` returns false on an unmodified document.

**Impact — C2.6 (autosave and status bar):** a naive stringify dirty-check marks every synced
document permanently dirty, producing an autosave loop. Dirty-checking must use structural
comparison (`util.isDeepStrictEqual` or an equivalent) or track Y.Doc update events directly.
Asserted in the test so the constraint cannot be forgotten.

> This also invalidated the spike's own first measurement: a stringify comparison reported
> 13/19 fixtures "lossy". Under deep equality it is 19/19. Any future fidelity check on this
> bridge must use deep equality.

### 2. The converters need plugin registration, and the builtins pull React

`docContentToPlate` / `plateToDocContent` throw (`no plugin registered for blockType …`) unless
`registerBuiltinPluginsOnce()` has run. The builtin plugins import `@udecode/plate-*/react`.

Measured, not assumed:

- The converter modules themselves are **React-free at runtime** (6-file value-import graph;
  verified by loading them in Node and confirming `react` was never required).
- The builtin plugins **do** import React packages — but they **load and register successfully in
  plain Node** (React is isomorphic). Server-side conversion works today.
- `@anydocs/editor` exposes **only a root export**, and that root pulls the whole Plate/React
  runtime (28-file graph).

**Impact — C6.1 (Hocuspocus `onStoreDocument`):** the realtime server can convert Y.Doc →
`doc-content-v1`, but importing `@anydocs/editor`'s root drags the editor runtime into the server
process. Recommended follow-up: add an `@anydocs/editor/converters` subpath export mirroring the
`@anydocs/core/portable` seam (strategy action 2), so the server imports converters + builtin
plugin definitions without the editor UI runtime.

> Note on method: a first static pass wrongly reported the converters as React-coupled because it
> followed `import type` edges. Type-only imports are erased at compile time. The corrected
> analysis follows value imports only, and was confirmed at runtime.

### 3. Two dependency-version conflicts must be resolved before C6.1

| Package | Conflict | Resolution |
|---|---|---|
| `@slate-yjs/core` | `@udecode/plate-yjs@49` depends on `^1.0.2`, but **1.0.2 raised its peer to `slate>=0.121`** while Plate 49 ships `slate@0.114`. `1.0.1` peers `slate>=0.70` and works. | Pin `@slate-yjs/core@1.0.1` (done for the spike), or upgrade Plate. Do **not** let `^1.0.2` resolve freely. |
| `@hocuspocus/provider` | `@udecode/plate-yjs@49` peers `provider@^2.15.2`; `cloud-realtime` runs `@hocuspocus/server@^4.3.0`. | `@hocuspocus/provider@4.x` exists (4.6.0). Align client provider to v4 and verify against the v4 server, or accept the peer warning after testing v2 provider ↔ v4 server. **Untested in this spike.** |

`yjs@13.6.31` is already in the workspace and needs no change.

## Not covered by this spike

- **Block `id` behaviour under concurrent insertion.** The fixtures exercised structure and
  convergence; `id` collision/regeneration under simultaneous inserts by two peers was not
  isolated. Worth a targeted check in C6.1 if block ids become anchors for comments (C6.4) or
  agent edits (C3.6).
- **Provider ↔ server version pairing** (see table above) — needs a live socket test.
- **Awareness / presence payloads** (C6.2, C6.3) — separate protocol from document sync.
- **Large-document performance** (C2.9) — fixtures here are small.

## Recommended sequencing impact

No change to epic order. Two prerequisites are now concrete rather than vague:

1. Add `@anydocs/editor/converters` subpath (small, mirrors action 2) — before C6.1.
2. Resolve the two version conflicts above — before C6.1.

C2.6's dirty-check design is constrained as described in finding 1 and should be written into
that story when it is created.

## References

- Test: `packages/cloud-realtime/tests/ydoc-bridge-spike.test.ts`
- Fixtures: `packages/editor/tests/fixtures/doc-content/` (19 files)
- Strategy: `artifacts/bmad/planning-artifacts/product-line-strategy-team-first-2026-08-18.md`
- Architecture: `architecture-cloud-team-edition.md` § realtime bridge
