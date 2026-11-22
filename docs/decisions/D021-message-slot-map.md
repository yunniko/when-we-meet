# D021 · Each message slot lists what it can show, and that copy fits one phone line

Date: 2026-11-22 · Goal: ui-kit G-001 M5 · Status: active (superseded by: —)
Context: the kit sizes a slot for its longest message (ui-kit D007), which needs to know every message a slot can show; reserving all of them left 2–3 empty lines under the create form's fields.
Decision: `lib/message-slots.ts` lists each slot's messages and, apart, the errors the browser already prevents (with the constraint that prevents each); reserved copy was shortened until it fits one line at 360px in all four locales.
Force: requirement — the Owner's 2026-11-22 brief (nothing moves, no wasted space); ui-kit D007.
Rejected: reserving every error key (unreachable errors held space); a per-slot height constant (wrong in some locale, and silent when copy changes).
Consequence: a new error key is listed in a slot or as browser-prevented, or the unit test fails; a browser-prevented entry is only true while its constraint (`required`, `maxLength`, `min`/`max`) stays on the input.
Evidence: tests/unit/message-slots.spec.ts; tests/e2e/ui-quality.spec.ts; E:\CLAUDE\projects\ui-kit\docs\reviews\2026-11-22-pilot-calibration.md
