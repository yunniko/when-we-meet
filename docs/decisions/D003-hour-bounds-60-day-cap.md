# D003 · Room creation validates hour bounds and caps the range at 60 days
Date: 2026-08-17 · Goal: G-001 · Status: active
Context: Not a product requirement; a guard against an unusably huge grid.
Decision: `lib/validation.ts` caps end − start at 60 days. Past dates are still not blocked (open question).
Rejected: —
Consequence: Revisit if a real use case needs longer.
Evidence: `lib/validation.ts`.
