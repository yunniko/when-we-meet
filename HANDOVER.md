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

**M5 (Testing & sign-off) — done, scope expanded mid-milestone by the Owner.**
Two features were added during M5 that weren't in the original milestone
plan (per OPERATIONS.md, routine decisions are made and logged, not stopped
on): the creator picking/locking a final meeting time, and room expiry. Both
are now covered by the same test suite M5 exists to build.

**Test infrastructure**: Vitest (`vitest.config.ts`, specs in
`tests/unit/`) for the pure `lib/*` modules — `slots.spec.ts`,
`results.spec.ts` (the overlap/ranking algorithm, explicitly called out in
the milestone), `validation.spec.ts`, `time.spec.ts`, `expiry.spec.ts` — 40
tests total. Playwright (`playwright.config.ts`, specs in `tests/e2e/`,
dedicated port 30099, `webServer` auto-boots `next dev`) for full flows:
`create-join-mark-results.spec.ts`, `name-collision.spec.ts` (both
confirm/decline branches), `finalize-meeting-time.spec.ts` — 4 tests, run
against the same dev Postgres database as local development (no separate
test DB — matches the listing-studio portfolio precedent; each test creates
its own uniquely-slugged room so this doesn't collide). `npm test` runs
both layers. Grid cells and results-heatmap cells carry `data-testid`
attributes (`slot-<date>-<hour>`, `result-slot-<date>-<hour>`) purely for
Playwright, since they have no other natural accessible role to select by.

**Bug found and fixed via this test suite**: `lib/slots.ts::formatDayLabel`
called `toLocaleDateString(undefined, {...})` — `undefined` locale means
"whatever the runtime's default locale is," and the Next.js **server**
(Node's default locale) and the **browser** (Chromium's default locale) can
disagree on that default, which they did in this dev environment ("Sat 10
Apr" server-rendered vs. "Sat, Apr 10" on client hydration) — a genuine
React hydration mismatch, not a cosmetic difference. Fixed by pinning the
locale to `"en-GB"` explicitly, so server and client always agree regardless
of the host machine's locale. This is exactly the class of bug e2e tests
against a real browser are for — it wouldn't have shown up in a
component-level test.

**New feature — creator picks/locks the final meeting time** (Owner request,
mid-M5): see D6/D7 for the full design. Summary: `Room.selectedDate` /
`selectedHour` hold the finalized slot (same wall-clock convention as
`Availability`). Once set: `saveAvailability` refuses all further marking
(checked server-side, not just hidden in the UI) and the room page shows a
static "closed" message instead of the grid; a banner
(`app/r/[slug]/finalized-banner.tsx`) reading "📌 Meeting time set: ..." is
shown to **everyone** (joined or not — it renders above the join form too)
on both the room and results pages, satisfying "very visible." Only the
room's creator sees pick/clear controls (`app/r/[slug]/results-board.tsx`:
click any heatmap cell, or a "Pick this time" button per "Best times" row;
the banner's "Clear selection" button). `selectFinalSlot` rejects slots
outside the room's date/hour range and slots that aren't strictly in the
future (`lib/time.ts::isSlotInFuture`, timezone-aware via the room's own
declared IANA zone). Creator permission is *not* a standalone cookie — see
D7 for why it's tied to a participant identity instead, which also
confirms the creator can mark their own availability exactly like anyone
else (they must join as a normal participant to be recognized).

**New feature — room expiry** (Owner request, mid-M5): a room is deleted 3
days after its finalized meeting date, or 3 days after the planning range's
end date if nothing was ever finalized (`lib/expiry.ts`). Enforced two ways:
lazily on access (`lib/room-access.ts::findActiveRoom` — an expired room
404s and is deleted the moment anyone opens it; every page that loads a room
by slug goes through this, not a raw `prisma.room.findUnique`), and via a
standalone sweep (`scripts/cleanup-expired-rooms.ts`, `npm run cleanup`) for
rooms nobody ever revisits, which would otherwise sit in the database
forever. The script is also wired into `docker-compose.yml` as an optional
`cleanup` profile service (a simple `while true; sleep 86400` loop around
the same script — no queue/scheduler infra added, consistent with D1).

**Verified**: full flow manually in a real browser (create room as
"Creator" → join → mark availability → results page shows creator-only pick
controls, confirmed a second participant does *not* see them → pick a slot
→ banner appears on both room and results pages, confirmed via `curl` with
no cookies that a brand-new visitor sees the banner but not the clear
button → grid replaced with the closed message → "Clear selection" reopens
marking) — plus the full automated suite (40 unit + 4 e2e, all green) which
now also covers this flow (`finalize-meeting-time.spec.ts`). Expiry itself
was also verified directly: inserted a room with a 2020 date range straight
into Postgres, confirmed `GET /r/<slug>` 404s (lazy deletion on access
firing correctly), then confirmed via `psql` the row was actually gone, not
just hidden. `npm run cleanup` run manually too (reports 0/0 against an
empty dev DB). tsc/eslint clean throughout. Test data cleaned up.

**Known gap, not exercised**: `selectFinalSlot`'s future-only rejection
(`isSlotInFuture`) is unit-tested thoroughly at the pure-function level but
wasn't separately exercised end-to-end against a past-dated room in a
browser (would have needed a room with a past date range, which the create
form doesn't currently block — see the still-open note in D3's neighborhood
about no past-date validation at creation). Low risk: the wiring is a single
`if` around a well-tested pure function.

## Loose end from this session (not yet actioned)

The Owner supplied a GitHub remote (`git@github.com:yunniko/when-we-meet.git`)
partway through M5. It's been added as `origin` (`git remote add origin ...`)
— a safe, local, reversible action — but nothing has been pushed. Per
VALUES.md ("nothing leaves the workspace without Owner approval") and
OPERATIONS.md (publishing/uploading always requires stopping to ask,
regardless of milestone position), pushing needs an explicit go-ahead even
though the Owner provided the URL themselves — supplying a remote isn't the
same as asking to push to it. Ask before the first push.

**Not started yet:** nothing from the original G-001 acceptance criteria —
all five milestones are done. Open items are the "known gap" above, the
still-outstanding real-touch-device check (M2/M4), and whatever the Owner
wants next (the participant-profile idea flagged earlier remains a
documented future direction, not started).

## How things fit together

- `lib/prisma.ts` — Prisma Client singleton (adapter-based, `@prisma/adapter-pg`),
  survives dev hot-reloads. Copy of the listing-studio pattern (D1).
- `lib/slug.ts` — 12-char unguessable room slug (`nanoid`, unambiguous
  32-symbol alphabet — no `0/O/1/I/l`) and a separate, higher-entropy
  `generateCookieToken()` for cookie identity (participants *and* the
  one-shot room-owner token — never typed/shared, so the unambiguous-alphabet
  constraint doesn't apply).
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
  get/set/clear (participant *and* owner cookies) and "resolve the current
  request's Participant from its cookie" respectively.
- `lib/owner.ts` — server-only. `isRoomOwner(room)` (is the currently
  logged-in participant the room's creator?) and `claimCreatorIfEligible`
  (the one-shot auto-tagging called from `joinRoom` — see D7).
- `lib/time.ts` — `nowInTimezone`/`isSlotInFuture`. The one place real IANA
  timezone conversion happens in the app (see AGENTS.md note); backs the
  "only pick a future meeting time" rule.
- `lib/expiry.ts` — pure `isRoomExpired`/`roomExpiryDate` (see D6). No
  Next/Prisma imports — unit-testable, and this is the single source of
  truth both `lib/room-access.ts` and `scripts/cleanup-expired-rooms.ts`
  call into.
- `lib/room-access.ts` — server-only `findActiveRoom(slug)`: the one place
  that turns "load a Room by slug" and "is it expired" into one call. Every
  page that loads a room by slug uses this instead of a raw
  `prisma.room.findUnique`.
- `app/actions.ts` — server actions (`"use server"`) for the **landing
  page** concern: `createRoom` follows the listing-studio pattern (D4
  there): typed `useActionState` result, submitted values echoed back on
  validation failure so the form doesn't lose what the user typed. Also
  generates the room's `ownerToken` and sets the owner cookie.
- `app/r/[slug]/actions.ts` — server actions for the **room** concern:
  `joinRoom` (new-name-vs-collision, see above; also calls
  `claimCreatorIfEligible` on every successful join), `leaveIdentity`
  (clears the participant cookie and redirects, used by "Not you? Use a
  different name"), `saveAvailability` (called imperatively from the client
  grid component, not bound to a `<form>` — Next.js server actions work as
  plain async RPC calls too, not only as form actions; refuses to save once
  the room is finalized), and `selectFinalSlot`/`deselectFinalSlot`
  (creator-only, re-verified server-side every time — see D7).
- `app/r/[slug]/finalized-banner.tsx` / `results-board.tsx` — client
  components for the "very visible" banner (shown to everyone) and the
  interactive results heatmap/best-times list (pick controls shown only to
  the creator).
- `lib/results.ts` — `computeResults`, the pure overlap/ranking aggregation
  behind the results page. Kept separate from `lib/slots.ts` since it's a
  distinct concern (aggregation vs. date/slot primitives) built on top of it.
- `scripts/cleanup-expired-rooms.ts` — standalone expiry sweep (`npm run
  cleanup`; also wired into `docker-compose.yml`'s `cleanup` service). Uses
  relative imports (`../lib/expiry`, `../generated/prisma/client`), not the
  `@/` alias — `tsx` doesn't resolve tsconfig path aliases without extra
  config, and this was simpler than adding it for one script.
- `tests/unit/*.spec.ts` — Vitest, one file per pure `lib/` module.
  `tests/e2e/*.spec.ts` — Playwright; `tests/e2e/helpers.ts` has the shared
  `createRoom`/`joinRoom`/`paintAndWaitForSave` flows every spec builds on.
- `prisma/schema.prisma` — see D2 below for why slots are plain
  `(date, hour)` pairs, not `DateTime` instants; D7 for the
  `creatorParticipantId` relation design.

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

### D6 — Room expiry is a coarse UTC-calendar-day policy, not timezone-aware (2026-08-17)
**Why:** Owner request: "removed three days after selected date or three
days after selected day range end." `lib/expiry.ts::roomExpiryDate` adds 3
calendar days (UTC) to whichever is relevant and compares against real
"now" — it does **not** convert through the room's declared timezone the
way `lib/time.ts::isSlotInFuture` does for the future-only check.
**Considered:** timezone-aware expiry (expire at local midnight in the
room's zone) — rejected as unwarranted precision for a cleanup grace
period; being off by a few hours around a boundary doesn't matter for "stop
holding onto this data," unlike the future-only check where getting the
comparison wrong could reject (or wrongly allow) a real pick. Enforcement
is two-layered because there's no queue/scheduler infra (D1): lazy
deletion on access (`lib/room-access.ts`) guarantees anyone who *does*
revisit an expired room can't see stale data, and the standalone script
(`scripts/cleanup-expired-rooms.ts`, also runnable from `docker-compose.yml`)
handles rooms nobody revisits, which lazy deletion alone would never touch.

### D7 — Creator permission is tied to a participant identity, not a standalone cookie (2026-08-17)
**Why:** the first design (still visible as the "one-shot" framing in
`lib/owner.ts`) used a single `ownerToken` cookie set at room-creation time
as the sole proof of creator-ness. The Owner's follow-up requirement —
"the log in under creator's name gives creator's permissions" — pointed at
a real gap in that design: a device-bound cookie has no recovery path, so
losing it (clearing cookies, switching devices) would permanently lock the
creator out of ever finalizing or clearing a meeting time, unlike
participant identity, which already has a recovery path (the name-collision
"is this you?" claim flow). The fix: `Room.creatorParticipantId` points at
a specific `Participant`, and `isRoomOwner` checks whether the *currently
logged-in participant* (via the ordinary participant cookie) is that one.
The `ownerToken` cookie still exists, but its only job now is a one-shot
signal consumed by `claimCreatorIfEligible` — called from every successful
`joinRoom` path — which tags the room-creating browser's *first* joined
participant as creator and never reassigns it after that. Net effect: (1)
the creator can rejoin as that same participant from any device via the
existing collision-claim flow and regain creator permissions — exactly what
was asked for; (2) the creator is confirmed to be able to mark availability
like anyone else, since becoming creator *requires* joining as a normal
participant first; (3) if the room-creator never joins at all, nobody ever
gets creator permissions for that room (no fallback) — a deliberate
trust-model consequence, not a bug, matching "whoever creates it and then
identifies themselves is the creator." **Considered:** keeping the
standalone owner cookie as the only mechanism — rejected once the
no-recovery-path gap was identified; a Google-account-style "transfer
ownership" flow — out of scope, no accounts exist in this app by design.

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

1. **All five milestones (M1-M5) are done and verified.** G-001's original
   acceptance criteria are all met; the finalize-meeting-time and
   room-expiry features the Owner added mid-M5 are done too. Next action is
   the Owner checkpoint before deciding what's next — there's no
   pre-planned M6.
2. **Pending: push to GitHub.** `origin` is set to
   `git@github.com:yunniko/when-we-meet.git` but nothing has been pushed —
   ask the Owner before the first push (see "Loose end" above).
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
   - Room creation still doesn't block past dates (noted since M1/D3) — now
     more relevant since a room whose whole range is already in the past
     would be immediately expiry-eligible. Not a bug (nothing breaks), but
     worth a product opinion: should the create form require the range to
     start today or later?
   - The future-only check on picking a meeting time is unit-tested but
     wasn't separately exercised end-to-end against a real past-dated room
     in a browser (see M5 "Known gap" above) — low risk, but flagging for
     completeness.
   - Room-expiry's deletion mechanics are verified (inserted an already-past
     room directly in Postgres, confirmed it 404s and the row is actually
     gone) and the "3 days" arithmetic is unit-tested, but nobody has
     watched a *real* room cross the boundary in real time (impractical to
     test that way) — low risk, since both pieces are independently
     confirmed correct.
