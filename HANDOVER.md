# Handover — When We Meet

Read this before touching the code. It's written so a newcomer (or a future
session with no memory of this one) can pick the project up cold. The goal
and milestone plan live in `GOALS.md`; project conventions in `AGENTS.md`.

## Current state

**M1 (Foundation) and M2 (Join & mark availability) — done.** M1:

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

M2:

- Cookie-based participant identity: an httpOnly cookie per room
  (`wwm_p_<roomId>`) holds an opaque `Participant.cookieToken` — never the
  participant id, never anything the client could forge into someone else's
  identity by guessing (see `lib/cookies.ts`, `lib/participant.ts`).
- Join flow (`app/r/[slug]/join-form.tsx` + `app/r/[slug]/actions.ts::joinRoom`):
  a new (case/whitespace-insensitive-unique) name creates a `Participant`
  immediately and redirects into the room. An existing name shows that
  participant's current marks (grouped by date, via
  `lib/slots.ts::summarizeAvailability`) and asks "is this you?" —
  confirming claims the cookie (no password, per the documented trust
  model), declining resets the form to try a different name.
- Availability grid (`app/r/[slug]/availability-grid.tsx`): a brush
  (Can / Can't / Clear) painted onto cells via unified pointer events
  (mouse + touch), with drag support. A stroke's accumulated changes save
  in one batched call to `saveAvailability` (in `app/r/[slug]/actions.ts`)
  when the pointer is released, which re-derives the participant from the
  cookie server-side (never trusts a client-supplied participant id) and
  upserts/deletes the touched `Availability` rows in a transaction.
- **Verified by actually running it**: joined as a new name, drag-painted
  CAN and CANNOT strokes, confirmed exact Postgres rows after each stroke,
  left and rejoined under a different-case version of the same name to
  trigger the collision prompt, confirmed identity via "yes that's me" and
  confirmed marks reloaded correctly, confirmed a second genuinely-new name
  joins cleanly and sees the first participant listed. Test data cleaned up
  afterward.
- **Bug found and fixed during verification**: a fast drag stroke could skip
  pointerenter events on intermediate cells, leaving gaps mid-stroke
  (reproduced via the browser automation tool's synthetic drag; plausible on
  real touch input too, where move events are often coarser than mouse).
  Fixed by tracking the last-painted grid cell and interpolating every cell
  on the straight line to the newly-entered one (`paintCellAtIndex` in
  `availability-grid.tsx`).
- **Known verification gap**: the pointer-event unification (mouse + touch
  via one event model, `releasePointerCapture` on pointerdown so
  `pointerenter` fires per-cell even for touch) is the standard technique
  and was exercised via simulated pointer/drag events, but not on a real
  touch device — flag this if a real-device check becomes easy to do
  before M4's dedicated mobile pass.
- `npx tsc --noEmit` and `npx eslint .` both clean throughout.

**Not started yet:** the preferred-availability layer, the overlap/results
ranking algorithm, and all automated tests (Vitest/Playwright — deferred to
M5 by design, verification so far has been manual/browser-driven per
milestone). That's M3 onward — see `GOALS.md`.

## How things fit together

- `lib/prisma.ts` — Prisma Client singleton (adapter-based, `@prisma/adapter-pg`),
  survives dev hot-reloads. Copy of the listing-studio pattern (D1).
- `lib/slug.ts` — 12-char unguessable room slug (`nanoid`, unambiguous
  32-symbol alphabet — no `0/O/1/I/l`) and a separate, higher-entropy
  `generateParticipantToken()` for cookie identity (never typed/shared, so
  the unambiguous-alphabet constraint doesn't apply).
- `lib/validation.ts` — Zod schema for room creation (`createRoomSchema`).
  This is where server-side validation rules for rooms live; keep it a pure
  module with no Next/Prisma imports so it stays unit-testable.
- `lib/slots.ts` — pure date/hour helpers shared by the grid and (later) the
  results algorithm: `enumerateDates`/`enumerateHours` (build the grid from
  a room's range), `dateOnly` (UTC-safe `Date` → `"YYYY-MM-DD"`),
  `summarizeAvailability` (used by the collision prompt, and reusable for
  M3's per-participant breakdowns). No Next/Prisma imports — unit-testable
  in isolation.
- `lib/cookies.ts` / `lib/participant.ts` — server-only (`import
  "server-only"` guards against accidental client-bundle inclusion). Cookie
  get/set/clear and "resolve the current request's Participant from its
  cookie" respectively.
- `app/actions.ts` — server actions (`"use server"`) for the **landing
  page** concern: `createRoom` follows the listing-studio pattern (D4
  there): typed `useActionState` result, submitted values echoed back on
  validation failure so the form doesn't lose what the user typed.
- `app/r/[slug]/actions.ts` — server actions for the **room** concern:
  `joinRoom` (new-name-vs-collision, see above), `leaveIdentity` (clears the
  cookie and redirects, used by "Not you? Use a different name"), and
  `saveAvailability` (called imperatively from the client grid component,
  not bound to a `<form>` — Next.js server actions work as plain async RPC
  calls too, not only as form actions).
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

1. M1 and M2 are both done and verified — nothing blocking. Next action is
   the Owner checkpoint (per OPERATIONS.md, stop at milestone boundaries)
   before starting M3.
2. M3: the "preferred" marking layer (constrained to a participant's own CAN
   slots — enforce this in `saveAvailability`, not just the UI), and the
   overlap/results algorithm (`lib/slots.ts` is the natural home for a pure
   `computeResults(rooms' participants + availability)` function so it stays
   unit-testable) ranking slots by availability count with full-group and
   preferred-overlap slots surfaced at the top.
3. Open questions/flags for the Owner, none blocking:
   - The timezone `<select>` currently lists all ~400 IANA zones via
     `Intl.supportedValuesOf`; fine functionally, may want a
     searchable/grouped UI once real users are involved (M4 polish
     candidate).
   - Touch drag-painting is implemented with the standard pointer-event
     technique but hasn't been checked on a real touch device yet (see M2
     verification notes above) — worth a real-phone check before/at M4.
