# D019 · Grid instructions: one visible line, the rest on demand
Date: 2026-11-22 · Goal: ui-kit G-001 (pilot) · Status: active (superseded by: —)
Context: a 290-character paragraph above the grid (five lines at phone width) explained mouse, touch,
bulk fill and the Prefer rule to everyone on every visit.
Decision: show `instructionsHint` ("Tap or drag to paint. Double-tap a header to fill it.") and put touch
details, bulk fill and the Prefer rule in an `InlineHelp` labelled "How to mark".
Force: judgment — the everyday action is what most visitors need; nothing measured compels it.
Rejected: removing the detail (the Prefer rule is not discoverable otherwise); a first-visit tour (state
to store, and rooms have no accounts).
Consequence: a new grid gesture goes into `instructionsDetail`; the visible hint stays one line.
Evidence: docs/reviews/2026-11-22-ui-message-inventory.md; tests/e2e/ui-quality.spec.ts.
