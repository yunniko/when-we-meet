<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# When We Meet — project conventions

Read `HANDOVER.md` first: current state, decision record (the *why* behind the
architecture), and next steps. The goal and milestone plan live in this
project's own `GOALS.md` (`E:\CLAUDE\projects\when-we-meet\GOALS.md`, starting
at G-001); Company-wide standards in `E:\CLAUDE\COMPANY\`.

- Stack: TypeScript, Next.js App Router, Prisma 7 (client generated into
  `generated/prisma` — regenerate with `npx prisma generate`), PostgreSQL via
  `docker compose up -d db`.
- No accounts, no auth, no payments, no queues — deliberately. Identity within
  a room is a cookie + display name (see GOALS.md trust model). Don't add
  login/password machinery without an Owner-approved scope change.
- Every time slot is stored and reasoned about as plain wall-clock (date,
  hour) — never convert through `Date`/timezone math. `Room.timezone` is a
  display label only. This is a deliberate DST-bug-avoidance decision; see
  HANDOVER D2.
- Mutations are server actions in `app/actions.ts` (or colocated per route as
  the app grows); validation schemas live in `lib/validation.ts`; keep
  business logic in pure `lib/*` modules so it's unit-testable without
  booting Next.
- DB URLs use `127.0.0.1`, not `localhost` (Windows IPv6 resolution issue).
- Two test layers: Vitest unit tests in `tests/unit/` for business logic,
  Playwright e2e in `tests/e2e/` for user flows. `npm test` runs both. Verify
  flows end-to-end (actually run the app) before calling work done.

