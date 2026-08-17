# Handover — When We Meet

Read this before touching the code. It's written so a newcomer (or a future
session with no memory of this one) can pick the project up cold. The goal
and milestone plan live in `GOALS.md`; project conventions in `AGENTS.md`.

## Current state

**M1 (Foundation) — in progress.** Done so far:

- Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind v4 scaffold,
  matching the portfolio's `create-next-app` defaults (see D1).
- Prisma 7 + PostgreSQL, `docker compose up -d db` for local Postgres
  (port 127.0.0.1:54321, matches `.env.example`). Schema (`prisma/schema.prisma`):
  `Room`, `Participant`, `Availability` (see D2 for the wall-clock-only design).
  One migration applied (`prisma/migrations/20260817055209_init`).
- Room creation flow, end to end: `app/page.tsx` (landing + form) →
  `app/create-room-form.tsx` (client component, `useActionState`) →
  `app/actions.ts::createRoom` (server action: validates via
  `lib/validation.ts`, generates an unguessable slug via `lib/slug.ts`,
  writes the `Room` row) → redirects to `app/r/[slug]/page.tsx` (reads the
  room and renders its details).
- **Verified by actually running it**: `npm run dev`, drove the form through
  a real browser (claude-in-chrome), submitted a room with a custom daily
  window (09:00–17:00, Europe/Prague, 2026-08-21 to 2026-08-23), confirmed
  the redirect to `/r/<slug>`, confirmed the rendered page matches, confirmed
  the row in Postgres via `docker exec ... psql`, confirmed `/r/<bad-slug>`
  404s. Test room deleted afterward to leave the DB clean.
- `npx tsc --noEmit` and `npx eslint .` both clean.

**Not started yet:** joining a room, marking availability (the grid), the
preferred layer, the overlap/results algorithm, the name-collision "is this
you?" flow, and all automated tests. That's M2 onward — see `GOALS.md`.

## How things fit together

- `lib/prisma.ts` — Prisma Client singleton (adapter-based, `@prisma/adapter-pg`),
  survives dev hot-reloads. Copy of the listing-studio pattern (D1).
- `lib/slug.ts` — 12-char unguessable room slug (`nanoid`, unambiguous
  32-symbol alphabet — no `0/O/1/I/l`).
- `lib/validation.ts` — Zod schema for room creation (`createRoomSchema`).
  This is where server-side validation rules for rooms live; keep it a pure
  module with no Next/Prisma imports so it stays unit-testable.
- `app/actions.ts` — server actions (`"use server"`). `createRoom` follows
  the listing-studio pattern (D4 there): typed `useActionState` result,
  submitted values echoed back on validation failure so the form doesn't
  lose what the user typed.
- `prisma/schema.prisma` — see D2 below for why slots are plain
  `(date, hour)` pairs, not `DateTime` instants.

## Decision record (append-only; newest last)

### D1 — Stack: TypeScript / Next.js / PostgreSQL / Prisma, no auth/queue/payment layers (2026-08-17)
**Why:** matches the portfolio default set in listing-studio D1 (one
language end-to-end, strongest off-the-shelf Next.js/Prisma ecosystem,
minimizes spread per STANDARDS.md). But this project has no accounts, no
payments, and no background jobs by design (G-001 acceptance criteria), so
Auth.js, Redis/BullMQ, and Stripe are deliberately **not** included — adding
them without a scope change would be a portfolio-consistency mistake, not a
win. **Considered:** a lighter framework (SvelteKit, plain Express) — no
material advantage since Next.js/Prisma/Postgres already work well for this
shape and keeping the same stack across the portfolio has real value (fewer
tools to maintain, shared conventions/CLAUDE.md patterns).

### D2 — Availability slots are plain wall-clock (date, hour) pairs, never converted through Date/timezone math (2026-08-17)
**Why:** the product decision (Owner, 2026-08-17) is a single implicit
timezone per room — everyone marks and views in the same wall-clock time,
with `Room.timezone` shown only as a label. Storing slots as real UTC
instants would require correct IANA-timezone-aware conversion (DST
transitions, offset changes) for zero actual benefit, since the app never
converts between zones. Storing `slotDate` (date) + `slotHour` (0-23 int)
sidesteps that whole class of bugs and keeps the overlap/ranking algorithm
(M3) pure integer/date comparison. **Considered:** storing a real `DateTime`
instant computed via the room's IANA timezone (e.g. with `date-fns-tz`) —
rejected as unnecessary complexity and a new dependency for a feature
(cross-timezone display) that's explicitly out of scope.

### D3 — Room creation form validates hour bounds and a 60-day range cap (2026-08-17)
**Why:** `lib/validation.ts` caps `endDate - startDate` at 60 days. Not a
product requirement from the Owner — a pragmatic guard so a mis-typed date
range can't produce an unusably huge availability grid in M2. Revisit if a
real use case needs a longer range.

## Future direction (not building yet — Owner flagged 2026-08-17)

The Owner wants to keep the door open for **participant profiles**: a
returning person could save a default weekly availability template and
apply it to a new room instead of re-entering everything. Nothing in the
current schema blocks this — the natural extension is an additive
`Profile` model (or similar) with a nullable `Participant.profileId` link
and a "default availability" template, applied as a pre-fill when a
profiled user joins a room. No accounts/auth exist yet either, so this
would likely land together with whatever identity system eventually
backs profiles. Don't build this now; just don't design `Participant`/
`Availability` in a way that would need a rewrite to add it later (it
currently doesn't).

## Next steps

1. Finish M1: nothing blocking — the milestone is functionally complete and
   verified. Next action is the Owner checkpoint (per OPERATIONS.md, stop at
   milestone boundaries) before starting M2.
2. M2: join flow (name entry, cookie-based `Participant` identity via
   `cookieToken`), the name-collision "is this you?" prompt (query
   `Participant` by `(roomId, nameKey)`), the 1-hour-slot grid with
   drag-to-paint CAN/CANNOT and mobile touch support.
3. Open question for the Owner at the M1 checkpoint: none blocking, but
   worth flagging — the timezone `<select>` currently lists all ~400 IANA
   zones via `Intl.supportedValuesOf`; fine functionally, may want a
   searchable/grouped UI once real users are involved (M4 polish candidate).
