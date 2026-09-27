# D014 · Per-identity undo/redo replaces the corner-fill confirmation prompt
Date: 2026-09-28 · Goal: G-001 (post-launch) · Status: active (superseded by: —)
Context: the corner cell fills the whole grid in one double-click/tap; an initial version asked for
confirmation before doing so past a few already-marked slots.
Decision: drop the confirmation prompt entirely and give the grid Undo/Redo buttons instead, backed by
a stroke-level history (one entry per drag/tap/day/hour/grid fill) persisted per room+participant in
`localStorage`, capped at 20 entries each way (`HISTORY_LIMIT`, lib/paint.ts).
Force: requirement — Owner instruction (2026-09-28): "remove confirmation and instead make markings
history with undo/redo buttons ... decide what is the reasonable size."
Rejected: the confirmation prompt (Owner asked for its removal); an unbounded history (unbounded
`localStorage` growth for no real benefit past a handful of undos).
Consequence: `HistoryEntry.before`/`after` must use `null` for "empty", never `undefined` —
`JSON.stringify` silently drops an `undefined`-valued property, corrupting persisted history across a
reload (caught by the JSON round-trip test). History is written synchronously at its three call sites
(endStroke/undo/redo), not a `useEffect`, so a reload can't race ahead of the write.
Evidence: tests/unit/paint.spec.ts (`applyHistorySide`, `pushHistory`, JSON round-trip); tests/e2e/undo-redo.spec.ts; commit ee8e689.
