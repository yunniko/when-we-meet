# Handover — When We Meet

Read this before touching the code. It's written so a newcomer (or a future
session with no memory of this one) can pick the project up cold. The goal
and milestone plan live in `GOALS.md`; project conventions in `AGENTS.md`.

## Current state

**M1 (Foundation), M2 (Join & mark availability), M3 (Preferred layer +
results), and M4 (Edge cases & polish) — done.** M1:

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

M3:

- Grid gained a fourth brush, **Prefer**, which only applies to a
  participant's own CAN slots. A drag stroke sets-or-clears "preferred"
  uniformly across every cell it touches — decided once, from the first
  cell's current state, at pointerdown (`strokeSetsPreferred` in
  `availability-grid.tsx`) — rather than toggling each cell independently,
  which would make a drag over a mix of preferred/not-preferred CAN cells
  behave unpredictably. Painting Prefer over a non-CAN cell is a deliberate
  no-op (no row created/changed). `saveAvailability` clamps `preferred` to
  `false` server-side whenever `status !== "CAN"` — the client brush logic
  already prevents this, but a data-integrity rule like this shouldn't rely
  solely on the client being well-behaved.
- `lib/results.ts::computeResults(dates, hours, totalParticipants, rows)` —
  pure aggregation (no Next/Prisma imports) over every `Availability` row in
  a room: counts CAN/CANNOT/preferred per slot, marks `isFullGroup` when
  `canCount === totalParticipants`, and sorts by `canCount` desc, then
  `preferredCount` desc, then chronologically. This is the natural seam for
  M5 unit tests.
- `app/r/[slug]/results/page.tsx` — new route, gated the same way as the
  grid (redirects to the join form if there's no participant cookie for this
  room). Pure server component (no interactivity, so no "use client"
  needed): a read-only heatmap reusing the grid's day/hour layout (green
  background opacity = `canCount / totalParticipants`, an amber ring for
  full-group slots, a star badge with the preferred count) plus a "Best
  times" list of the top 10 slots with `canCount > 0`. Linked from the room
  page header ("See results →") and back again ("← Edit my availability").
- **Verified by actually running it**: seeded a second participant
  (`Bob`) directly in Postgres with a CAN/CAN/CANNOT pattern, joined as a
  new participant (`Alice`) in a real browser, drag-painted two overlapping
  CAN slots, switched to the Prefer brush and confirmed clicking an unmarked
  cell was a true no-op (checked Postgres — no row), marked one overlapping
  slot preferred, confirmed the exact Postgres rows for both participants,
  then opened `/r/[slug]/results` and confirmed by hand: the two slots both
  participants share are shown at full intensity with the full-group ring,
  the preferred slot shows `★1`, and "Best times" ranks the preferred slot
  above the otherwise-identical non-preferred one. Test data cleaned up
  afterward.
- `npx tsc --noEmit` and `npx eslint .` both clean throughout.

M4:

- **Bug fix — join-name race condition**: `joinRoom`'s "is this a new name"
  check (`findUnique` then `create`) had a TOCTOU gap — two people submitting
  the same brand-new name close enough together could both pass the
  `findUnique` before either `create()` committed, and the loser would hit
  the `(roomId, nameKey)` unique constraint and throw, surfacing as an
  unhandled 500 instead of the intended "is this you?" prompt. Fixed by
  catching `Prisma.PrismaClientKnownRequestError` with `code === "P2002"`
  around the `create()` call and recovering via the same `collisionState`
  helper the ordinary collision path uses (factored out of the old inline
  code specifically for this reuse). See D4 for how this was verified.
- **Single-day/fixed-hours event mode**: no code changes were needed for the
  mode itself (a room with `startDate === endDate` and a narrow
  `dayStartHour`/`dayEndHour` already "just works" — the grid renders one
  date column). Verifying it did surface a small display bug: the room and
  results headers showed a redundant `"2026-09-05 – 2026-09-05"` for a
  single-day room. Fixed with `lib/slots.ts::formatDateRange`, which collapses
  to one date when `startDate === endDate`.
- **Mobile/responsive pass**: `mcp__claude-in-chrome__resize_window` wasn't
  actually changing the tab's viewport in this environment (`window.innerWidth`
  stayed at the host window's size after calling it), so the check was done
  by embedding the app in a 390×844 `<iframe>` on a blank page instead — a
  legitimate way to force a narrow viewport for layout purposes. All three
  pages (create-room, join/grid, results) held up with no horizontal
  overflow; the toolbar and header already had `flex-wrap`. Bumped
  touch-target sizing as a precaution since real-device touch testing is
  still outstanding (see M2 verification notes): grid cells `h-8`→`h-10`
  (32px→40px) in both `availability-grid.tsx` and `results/page.tsx`, brush
  button padding `px-2.5 py-1.5`→`px-3 py-2`.
- **Timezone picker**: regrouped the flat ~400-entry `<select>` into region
  `<optgroup>`s (`groupedTimezoneOptions()` in `create-room-form.tsx`,
  grouping by the part of the IANA name before the first `/`) with
  underscore-free labels (e.g. "Los Angeles" instead of "Los_Angeles").
- **Abuse-resistance review** (see D4): no code changes — reviewed and
  confirmed adequate.
- `npx tsc --noEmit` and `npx eslint .` both clean throughout.

**Visual redesign (post-M4, Owner-directed, 2026-08-17):** light-only warm
theme replacing the previous auto-dark-mode default, plus a hero
illustration on the landing page. See D5 for the full rationale and token
list. Touched every page (`app/page.tsx`, `create-room-form.tsx`,
`join-form.tsx`, `app/r/[slug]/page.tsx`, `availability-grid.tsx`,
`results/page.tsx`) and `app/globals.css`. Verified by actually running it:
created a room, joined, painted availability, and viewed results in a real
browser against the new palette — no leftover dark-mode classes, hero image
renders and is optimized by `next/image`, all interactive flows still work.
tsc/eslint clean. Test data cleaned up.

**Not started yet:** all automated tests (Vitest/Playwright — deliberately
deferred to M5; verification through M1-M4 and the visual redesign has been
manual/browser-driven per milestone, per the checkpoint discipline in
OPERATIONS.md). See `GOALS.md`.

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
- `lib/slots.ts` — pure date/hour helpers shared by the grid and the results
  page: `enumerateDates`/`enumerateHours` (build the grid from a room's
  range), `dateOnly` (UTC-safe `Date` → `"YYYY-MM-DD"`), `formatHoursWindow`/
  `formatDayLabel`/`formatHour` (display strings), `summarizeAvailability`
  (used by the join-collision prompt), and the `CellMark`/`AvailabilityRow`
  types shared across the grid, actions, and results. No Next/Prisma
  imports — unit-testable in isolation.
- `lib/results.ts` — `computeResults`, the pure overlap/ranking aggregation
  behind the results page (see M3 below). Kept separate from `lib/slots.ts`
  since it's a distinct concern (aggregation vs. date/slot primitives) built
  on top of it.
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

### D4 — Room-slug/cookie-token entropy is adequate as-is; no rate-limiting added (2026-08-17)
**Why:** M4's "basic abuse-resistance" pass reviewed this rather than adding
new mechanisms. Room slugs are 12 characters from a 32-symbol alphabet
(`lib/slug.ts`) — roughly 60 bits of entropy, i.e. not brute-forceable, and
there is no listing/enumeration endpoint anywhere in the app (no admin page,
no "recent rooms" feature) so guessing is the only avenue. Participant
cookie tokens are 32-character nanoid strings (~190 bits) and httpOnly, so
not readable via client-side script even on the same origin. No
rate-limiting was added to room/participant creation — there's no
infrastructure for it yet (no Redis, per D1) and the trust-model/no-budget
constraints in G-001 don't call for it at this scale; revisit if the app
ever gets exposed to genuinely adversarial traffic rather than friend
groups. The join-name race fix (see "M4" above) was verified by directly
reproducing the underlying Prisma behavior it depends on — two concurrent
`participant.create()` calls for the same `(roomId, nameKey)` were run via a
standalone script against the dev database, confirming one fulfills and the
other rejects with `Prisma.PrismaClientKnownRequestError` / `code: "P2002"`
— rather than by forcing the exact race through two live HTTP requests,
which proved unreliable to trigger deterministically via browser automation
(two "simultaneous" tool-driven form submissions weren't fast enough to
land inside the race window in testing). The recovery code path itself
(`collisionState` helper) is exercised by the ordinary, non-raced collision
flow, which is the same code.

### D5 — Light-only warm/hand-drawn theme, dark mode removed (2026-08-17)
**Why:** Owner request — a light theme, and a hand-drawn/crayon-illustration
hero image for the landing page. Rather than layer a warm palette under the
existing automatic-dark-mode setup, dark mode was removed outright: the
`@media (prefers-color-scheme: dark)` block and every `dark:` Tailwind
variant (previously in `create-room-form.tsx`, `availability-grid.tsx`,
`join-form.tsx`, `results/page.tsx`) are gone. **Considered:** keeping dark
mode and just re-tuning its palette too — rejected because the Owner asked
for "light themed" specifically, and maintaining a second (dark) palette
nobody asked for is exactly the kind of unrequested complexity STANDARDS.md
says to avoid. If dark mode is wanted later, it's a separate, explicit ask.
Design tokens now live in `app/globals.css` as CSS custom properties
(`--background` cream `#faf3e6`, `--surface` near-white card tone
`#fffcf5`, `--foreground` warm brown-black ink `#33261a`, `--muted` for
secondary text, `--border` warm tan, `--accent`/`--accent-hover` a crayon
orange `#e0762a`/`#c4611c` used for every primary action) registered into
Tailwind v4 via `@theme inline`, giving `bg-surface`, `text-muted`,
`border-border`, `bg-accent`, `accent-accent` (native `accent-color` on
checkboxes), etc. as ordinary utility classes. The existing CAN/CANNOT/
PREFER semantic colors (emerald/rose/amber) were kept as-is — they already
read as saturated "crayon" colors that suit the illustration, no change
needed. Every page's content now sits in a rounded, bordered `bg-surface`
card on the cream page background, echoing the "note" look interior pages
didn't have before.

**Hero image asset**: `assets/hero-when-we-meet.jpg` (2816×1536 JPEG,
~3.3MB) is an Owner-supplied, AI-generated (Gemini) illustration, used as
the landing page's hero via a static `next/image` import (Next.js optimizes
it to appropriately-sized/formatted variants at request time, so the large
source file doesn't ship as-is). It already contains the "When We Meet"
title lettering, so the page's own `<h1>` is `sr-only` (kept for
accessibility/SEO, not shown — no duplicate visible title). No third-party
license concern: Owner-supplied for their own project.

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

1. M1 through M4 are all done and verified — nothing blocking. Next action
   is the Owner checkpoint (per OPERATIONS.md, stop at milestone boundaries)
   before starting M5.
2. M5 (testing & sign-off, per GOALS.md): Vitest unit tests for the pure
   modules (`lib/slots.ts`, `lib/results.ts`, `lib/validation.ts` are all
   Next/Prisma-free and ready for this — the overlap/ranking algorithm in
   particular deserves direct coverage of its sort order and edge cases like
   zero participants or a slot nobody marked), Playwright e2e for
   create → join → mark → view-results and the name-collision flow. All
   verification through M1-M4 has been manual/browser-driven per milestone;
   M5 is where that gets automated so future changes don't need a full
   manual pass every time.
3. Open questions/flags for the Owner, none blocking:
   - Touch drag-painting (both the brush paint and the Prefer toggle) is
     implemented with the standard pointer-event technique and touch-target
     sizing was bumped defensively in M4, but it still hasn't been checked
     on a real touch device (browser automation can't drive real touch
     events, and this session's window-resize tool wasn't changing the
     actual viewport either — the mobile check was done via an emulated
     iframe instead). Worth a real-phone check whenever convenient.
   - The results heatmap's color scale only encodes `canCount`; `cannotCount`
     isn't visually distinguished from "nobody's said anything yet" (both
     render as the same empty/pale cell — though the exact counts are in
     each cell's hover tooltip). Not a spec gap — the acceptance criteria
     only ask for availability ranking — but worth a design opinion from the
     Owner if it turns out confusing in practice.
