# D020 · Start and end dates share one full-width message slot
Date: 2026-11-22 · Goal: ui-kit G-001 (pilot) · Status: active (superseded by: —)
Context: each date had its own half-width slot; at 390px the end-date error wrapped to two or three lines
and moved the rest of the form down 20–40px, off-screen, where the browser's shift API does not look.
Decision: the pair is a `FieldGroup` ("Dates") whose one slot shows whichever date error applies; date
errors were shortened to fit one line at 390px in all four locales.
Force: requirement — ui-kit's no-layout-shift rule, measured by `expectUnmoved` at 390px in each locale.
Rejected: reserving two lines under each date (permanent empty space); smaller error text (readability).
Consequence: a new date error must fit one line at 390px in every locale, or the ui-quality spec fails.
Evidence: tests/e2e/ui-quality.spec.ts; commit 5f0d7f8.
