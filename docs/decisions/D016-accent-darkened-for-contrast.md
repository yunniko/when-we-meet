# D016 · Accent darkened from #e0762a to #ad4f18
Date: 2026-11-22 · Goal: ui-kit G-001 (pilot) · Status: active (superseded by: —)
Context: the accent is link text on the page background and the fill under white button text; axe
measured the links at 4.34:1, and white on the old accent was 3.09:1.
Decision: accent `#ad4f18`, with the pairs accent/background and accent/surface declared at 4.5 in
`design/tokens.json`, so the token check fails if it drifts back.
Force: requirement — WCAG 2.1 AA 1.4.3 (4.5:1 for normal text), measured by axe in the ui-quality spec.
Rejected: a second, darker link colour beside the orange (two accents for one role); larger link text
(does not fix the button label).
Consequence: any accent change keeps both declared pairs at 4.5 or more; the warmer orange survives only
in the hero illustration.
Evidence: design/tokens.json; tests/e2e/ui-quality.spec.ts; commit 7b3593d.
