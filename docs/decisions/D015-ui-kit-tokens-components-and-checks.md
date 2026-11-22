# D015 · The UI is built on the Company ui-kit: tokens, kit components, ui:check
Date: 2026-11-22 · Goal: ui-kit G-001 (pilot) · Status: active (superseded by: —)
Context: messages were shown four different ways (spans, banners, `role=alert` paragraphs, inline text),
appeared and pushed content down, and colours were raw Tailwind values scattered over every file.
Decision: colours, radii and type come from `design/tokens.json` (generated into `app/tokens.css`); every
message is shown through a kit component (`Field`, `FieldGroup`, `StatusSlot`, `ConfirmDialog`,
`InlineHelp`, `EmptyState`), copied into `components/ui-kit/` by the kit's sync and never edited here.
Force: requirement — Owner instruction (2026-11-22): one company-wide way to keep each project's UI
consistent, with when-we-meet as the pilot.
Rejected: per-file fixes (the inconsistency returns with the next screen); a component-library
dependency (ui-kit D005).
Consequence: `npm run ui:check` must pass (static checks, then the ui-quality e2e specs); a new message
gets a key whose suffix names its kind and fits that kind's length cap.
Evidence: tests/e2e/ui-quality.spec.ts; docs/reviews/2026-11-22-ui-message-inventory.md; commit 7b3593d.
