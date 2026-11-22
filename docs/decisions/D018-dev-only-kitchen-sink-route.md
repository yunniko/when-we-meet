# D018 · The kit's kitchen sink is a development-only page, proven absent from builds
Date: 2026-11-22 · Goal: ui-kit G-001 (pilot) · Status: active (superseded by: —)
Context: the kitchen sink shows every kit component in every state with this project's tokens; it is a
test affordance and must not ship.
Decision: `app/dev/ui-kit/page.dev.tsx` is routed only when `next.config.ts` adds the `dev.tsx` page
extension outside production; `npm run build:check` builds and fails if the sink's marker is in `.next`.
Force: judgment — STANDARDS.md requires a test affordance to be verified absent from production, but
nothing compels this mechanism over others.
Rejected: `notFound()` behind `NODE_ENV` (the code still ships); a separate demo app (the point is to see
the kit with this project's tokens and fonts).
Consequence: run `build:check`, not `build`, before a deploy. Import the sink from `kitchen-sink`, never the
kit index (an index export put it in every bundle).
Evidence: tests/e2e/ui-quality.spec.ts; scripts/ui-kit/build-clean.mjs; commit 5f0d7f8.
