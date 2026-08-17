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

## Post-launch UX round (Owner-directed, 2026-08-17)

Several small features/fixes requested after the live deployment above.

- **Weekend shading**: `lib/slots.ts::isWeekend(date)` (pure, UTC-noon-parse
  trick like `formatDayLabel`). Applied to the day-header cells and
  unmarked-cell background in both `availability-grid.tsx` and
  `results-board.tsx`, via a new `--color-weekend` token
  (`app/globals.css`) — a shade darker than `--background`/`--surface`.
  On the results heatmap, the intensity overlay had to move from
  `backgroundColor` to `backgroundImage: linear-gradient(c, c)` — an inline
  `style.backgroundColor` unconditionally overrides a class's
  `background-color`, which would have hidden the weekend tint entirely at
  low availability; a solid-color gradient painted as a `background-image`
  layers on top of the class's `background-color` instead, so the tint
  shows through where availability is low.
- **Bug found and fixed: sticky date headers weren't pinning.** The date
  header row already had `sticky top-0`, but scrolling never kept it
  visible. Root cause: the grid's wrapper had `overflow-x-auto` with no
  explicit `overflow-y`, and per the CSS Overflow spec, setting one axis to
  a non-`visible` value silently forces the other to `auto` too if it isn't
  already non-visible — so the wrapper became an (invisible, never-scrolled)
  vertical scroll container, and `position: sticky` had nothing to stick
  against within it while the actual page scrolled around it instead. Confirmed
  and fixed by making the bounding behavior explicit rather than accidental:
  the wrapper is now `max-h-[70vh] overflow-auto` in both
  `availability-grid.tsx` and `results-board.tsx` — the grid is a real,
  intentionally bounded scroll pane (both axes), so sticky headers/row-labels
  correctly pin while scrolling within it. (An earlier attempted fix,
  explicitly setting `overflow-y-visible`, does not work — the browser
  coerces it back to `auto` per that same spec rule; recorded here so it
  isn't retried.)
- **Join-form clarity**: added copy under "Your name" explaining the name
  must be unique in the room and will be needed again to edit marks later
  from elsewhere. The "Already in this room: ..." list is no longer plain
  text — each name is its own `<form action={formAction}>` submitting a
  hidden `name` field, styled as an underlined link ("it's me"), so
  returning participants can click their name instead of retyping it
  (still lands on the ordinary collision-confirm step, not an instant
  claim — no change to the trust-model ceremony, just less typing/typo
  risk). `join-form.tsx`.
- **Results-page participant list**: `results/page.tsx` now fetches
  participant names (not just a count) and renders "Participants: ..." as
  plain text — deliberately not clickable, unlike the join screen's list;
  this is informational context for the results, not an identity-switching
  affordance.
- **"Leave the room"**: distinct from the existing "Not you? Use a
  different name" (which only switches the active cookie — the participant
  and their marks stay in the room). This is destructive: a new
  `leaveRoom` action (`app/r/[slug]/actions.ts`) deletes the participant
  row outright (cascades to their `Availability` rows). Gated behind an
  inline two-step confirmation (`leave-room-button.tsx`, a client
  component) rather than a native `confirm()` dialog, matching the rest of
  the app's custom-styled UI. **If the leaving participant was the room's
  creator**, ownership auto-transfers to whichever remaining participant
  has been in the room longest (`orderBy: createdAt asc`), so the room
  doesn't become permanently unable to finalize/clear a meeting time; if
  nobody remains, the room simply has no creator (same as if the original
  creator had never joined — see D7). This was an explicit Owner design
  choice among three options (forbid leaving / auto-transfer / leave
  ownerless) — auto-transfer was picked to avoid stranding a creator who
  wants to delete their data while keeping the room functional for whoever
  stays.
- **Verified**: full manual pass in a real browser for weekend shading
  (visually confirmed on a Mon-Sun room) and the sticky-header fix
  (scrolled a 24-hour grid, header stayed pinned, confirmed on both the
  grid and results heatmap). Leave-room confirmed end to end including a
  DB check (participant + availability rows actually gone, not just the
  cookie cleared) and the ownership-transfer case (seeded a second
  participant, had the creator leave via the real UI, confirmed via SQL
  the second participant became creator). New Playwright spec
  `tests/e2e/leave-room.spec.ts` (cancel doesn't delete; confirm deletes;
  rejoining under the same name afterward gets no collision prompt, proving
  the row is really gone) — the ownership-transfer case itself is only
  manually verified, not covered by an automated test yet (flagged below).
  tsc/eslint clean; full suite (43 unit + 5 e2e) green. Not yet redeployed
  to production as of this note — see "Next steps".
- **Note for future e2e specs needing direct DB access**: `lib/prisma.ts`
  imports the generated Prisma client, which is ESM (`import.meta`) —
  Playwright's own test transform can't load it directly (fails with
  `Cannot use 'import.meta' outside a module`), unlike Vitest and Next.js
  itself, both of which handle it fine. Assert through the UI instead (as
  `leave-room.spec.ts` does), or invest in Playwright ESM config if
  direct-DB assertions become worth it.

## Daily time-window presets & Best Times missing-names (Owner-directed, 2026-08-17)

Two more post-launch changes, made and deployed after the "Post-launch UX
round" above (which by this point had already been redeployed).

- **Daily time-window presets**: the room-creation form's old single "whole
  day" checkbox is now a `<fieldset>` of five radio buttons — Evening
  (17:00–22:00, default), Whole day (07:00–22:00), Morning (07:00–12:00),
  Midday (12:00–17:00), Custom range (reveals the existing start/end hour
  number inputs). Preset definitions live in `lib/room-presets.ts`
  (`DAILY_PRESETS`, `isPresetKey`) — a pure module, unit-tested
  (`tests/unit/room-presets.spec.ts`) — shared by the client form
  (`create-room-form.tsx`, builds the radio list from it) and
  `app/actions.ts::createRoom` (looks up `dayStartHour`/`dayEndHour` from the
  chosen preset server-side when `preset !== "custom"`, otherwise reads the
  submitted custom hours — the server never trusts client-computed hours for
  a named preset). The old `allDay` boolean field is gone entirely, not kept
  as a compatibility shim.
- **Bug found and fixed: the preset radio group reset to "Evening" after a
  failed submission**, while the (still-visible, since visibility is driven
  by separate `showCustom` state) custom hour inputs kept the user's typed
  values — a resubmit would then silently create the room with the wrong
  hours. Root cause: React 19 automatically calls the native
  `HTMLFormElement.reset()` after any action dispatched via a form's
  `action={fn}` prop, success or failure — including for a form the app
  already treats as fully controlled. That reset mutates each radio's
  `checked` DOM property directly (each control reverts to whatever it was
  at mount, via its `defaultChecked` attribute), bypassing React's
  controlled-value bookkeeping entirely, and React does not reliably repair
  the visible DOM state back to match component state afterward — so simply
  converting the radios from `defaultChecked` to a controlled `checked` prop
  (the first fix attempt) did **not** resolve it; this was confirmed by
  reproducing the bug again with the controlled version in a live browser
  before looking further. The actual fix: stop using the form's native
  `action` prop. `create-room-form.tsx` now has `<form onSubmit={handleSubmit}>`,
  where `handleSubmit` calls `event.preventDefault()` and dispatches the
  `useActionState` action manually (`startTransition(() => formAction(new
  FormData(event.currentTarget)))`). That automatic reset is specifically
  part of React-DOM's handling of native form submission through the
  `action` prop — invoking the action function directly, outside that path,
  never triggers it, so there's nothing to desync from. `pending` is now
  tracked via a separate `useTransition()` rather than `useActionState`'s own
  third return value, since that value's semantics assume the native
  form-action path. **Considered**: forcing a re-render/DOM fixup via
  `useEffect` after the action resolves — rejected as a workaround for a
  problem that has a clean root-cause fix (don't take the code path that
  causes the reset) rather than a patch over the symptom.
- **Best Times missing-names**: `lib/results.ts::computeResults` now takes
  `participantNames: string[]` instead of a bare `totalParticipants: number`,
  and each `SlotResult` carries `missingNames: string[]` — every participant
  who did *not* mark that slot CAN (explicit CANNOT or simply never marked
  it). `results-board.tsx`'s Best Times list shows all of them ("Can't:
  Alice, Bob, ...", no truncation — confirmed with the Owner that a
  1-2-name cap wasn't wanted, all names should show regardless of count).
  `results/page.tsx` now fetches each availability row's participant name
  alongside it to build this.
- **Verified**: reproduced the exact original bug report in a live browser
  (invalid date range to force a validation error, Custom range selected
  with typed 11/15 hours) both before the fix (confirmed broken) and after
  (confirmed the radio and hours both survive the error round-trip
  correctly), then completed a real submission and confirmed the created
  room's grid actually only shows hours 11:00–15:00. Full suite green: `npx
  tsc --noEmit` and `npx eslint .` clean, 46 unit tests / 5 e2e tests pass
  (`npx vitest run`, `npx playwright test`). Pushed and redeployed to
  https://meet.app.julienika.cz (`git pull && docker compose --profile app
  up -d --build`); confirmed live via browser on the production URL and
  confirmed the other four sites on the shared host still respond.

## CANNOT-ranking, join-page clarity, and a participant cap (Owner-directed, 2026-08-17)

Three more small rounds, made and deployed after the preset/missing-names
round above.

- **Ranking now factors in explicit CANNOTs**: the Owner asked whether
  unmarked slots should be inferred as CAN or CANNOT depending on how a
  participant used the two brushes (e.g. "if someone only ever marked
  CANNOT, treat their silence elsewhere as CAN"). Recommended against that —
  it makes a slot's meaning depend on *how* other people used the tool,
  fragile and surprising the first time someone mixes both — and instead
  proposed factoring `cannotCount` into the ranking directly, which the
  Owner agreed to. `lib/results.ts::computeResults`'s sort now breaks ties
  on `canCount` by ascending `cannotCount` (fewer explicit "I can't make it"
  marks ranks higher) before falling through to `preferredCount` and
  chronological order — a slot nobody's ruled out now correctly outranks an
  equally-CAN slot someone has. Unmarked slots are still simply absent from
  both counts, not inferred either way; that design question is otherwise
  closed for now.
- **Join-page clarity**: the name-entry page previously showed only the room
  title (and, if applicable, the existing-participants list) — nothing told
  a first-time visitor the room's date range/hours/timezone or what
  entering a name was about to do. `join-form.tsx` now takes
  `dateRangeLabel`/`hoursLabel`/`timezone` props (computed in
  `app/r/[slug]/page.tsx` the same way the joined room page already does)
  and renders them under the title, plus a short paragraph explaining the
  join flow (no account, just a name, see combined results afterward).
- **Participant cap**: raised by the Owner as an abuse-resistance question —
  is there any limit on how many people can join one room? There wasn't.
  Considered reCAPTCHA first and recommended against it: it needs a Google
  account (an external-service dependency requiring Owner sign-off per
  VALUES.md) and adds friction to every real join, which cuts directly
  against the app's core "no accounts, frictionless" design. Landed on a
  flat cap instead: `lib/validation.ts::MAX_PARTICIPANTS_PER_ROOM = 100`,
  checked in `joinRoom` (`app/r/[slug]/actions.ts`) only on the
  new-participant path — reclaiming an existing name via the collision flow
  doesn't create a row, so it still works past the cap, which is correct
  (it's not adding a new participant). Chosen as a defensive backstop
  against scripted join-spam (no accounts/CAPTCHA exist to stop that
  otherwise), not a limit real group usage would approach; not
  transaction-guarded against a race at the exact boundary since being off
  by a few during a burst doesn't matter for what this is defending against.
- **Verified**: the CANNOT-ranking fix was checked by seeding two
  equally-CAN slots in the local dev DB with different `cannotCount`s (one
  participant explicitly CANNOT on one slot, simply unmarked on the other)
  and confirming via the real results page that the zero-cannot slot ranked
  first despite being chronologically later — plus a new unit test
  (`tests/unit/results.spec.ts`) covering the same case. The participant cap
  was checked by seeding a room with exactly 100 participants directly in
  Postgres and confirming, in a real browser, that joining as a 101st
  produces the limit error while reclaiming one of the existing 100 names
  still works normally. tsc/eslint clean, 47 unit + 5 e2e tests green.
  Pushed and redeployed to https://meet.app.julienika.cz across two rounds
  (ranking fix, then join-clarity + cap together); confirmed live via
  browser both times and confirmed the other sites on the shared host
  stayed unaffected. All manual test rooms cleaned up from both the local
  dev and production databases afterward.
- **Not automated**: the participant-cap check has no dedicated unit or e2e
  test (seeding 100 real participants through an e2e flow would be slow and
  the underlying logic is a one-line count comparison) — verified manually
  as described above, consistent with how the join-race fix in D4 was
  verified against the dev database directly rather than forced through
  live HTTP concurrency.

## Multi-language UI — G-002, M1 done (Owner-directed, 2026-08-17)

A new goal (`GOALS.md` G-002), not a post-launch tweak to G-001 — the Owner
asked for full EN/RU/CZ/DE UI translation, confirmed as "a big task"
deserving its own milestone plan per OPERATIONS.md rather than another
progress-log bullet under G-001. See D8 for the technical design (copied
from listing-studio's established `next-intl` pattern).

**M1 — i18n infrastructure — done.** `next-intl` installed and wired
(`next.config.ts`, `i18n/request.ts`, `app/layout.tsx`'s
`NextIntlClientProvider` + `lang={locale}`), cookie-based locale resolution
with English-fallback deep-merge, a language switcher visible on every page
(added once in the root layout rather than per-page, so M2-M4 don't need to
touch every page just to add it), and `messages/{en,ru,cs,de}.json` proving
the pipeline on one real string (the switcher's own "Language" label,
translated in all four). No page content is translated yet — that's M2-M4.

**Verified**: switched language live in a real browser, confirmed the
switcher's own label re-renders in the new language, confirmed the `locale`
cookie is set and survives a real (non-client-side) navigation, confirmed
falling back to English round-trips correctly. `npx tsc --noEmit` clean,
`npx eslint .` clean (pre-existing unrelated warnings only), 53 unit tests
green (`tests/unit/ui-locales.spec.ts` new, covering `mergeMessages`,
`localeDisplayName`, `isUiLocale`), 5 e2e tests green unchanged (they run
against the default English locale, no cookie set, so nothing needed to
change there). Pushed and redeployed to https://meet.app.julienika.cz;
confirmed live and confirmed the other sites on the shared host stayed up.

**M2 — landing/create-room page translated — done** (Owner said "go ahead"
after reviewing M1). Every string on `app/page.tsx` and
`create-room-form.tsx` now goes through `useTranslations`/`getTranslations`:
hero image alt text, tagline, all form labels/placeholders/help text, the
daily-time-window preset names, and the submit button — in `Landing` and
`CreateRoom` namespaces in `messages/*.json`. `app/layout.tsx`'s metadata
(browser tab title, meta description) is now locale-aware too, converted
from a static `export const metadata` to an async `generateMetadata()`
calling `getTranslations("Metadata")`.

Validation error messages needed the most design thought. `lib/validation.ts`'s
Zod schema messages changed from English sentences to i18n KEY strings
(`"Pick a timezone"` → `"timezoneRequired"`, etc.) — confirmed by re-reading
listing-studio's actual `validation.ts`/`*-actions.ts`/form-component source
(not just the earlier survey's summary) that this is the real established
pattern, not the "translator-aware schema factory" guessed at when M2 was
first planned: the schema can't translate anything itself (it's built at
module scope, outside any request/locale context), so it stays in raw keys,
the server action passes them through untouched
(`app/actions.ts::createRoom`'s `error`/`fieldErrors` are now documented as
keys, not sentences), and the client component resolves them via
`t(`errors.${key}`)`. Also added explicit key-based messages to the
`dayStartHour`/`dayEndHour` numeric bounds, which previously had none (a
malformed submission would have leaked one of Zod's raw internal English
strings straight to the UI, in any language). `lib/room-presets.ts`'s
`DAILY_PRESETS` lost its baked-in English `label` field entirely — preset
names are now translated words (`CreateRoom.presets.*`), and the
"(17:00–22:00)"-style hour range is composed at render time from the
existing `lib/slots.ts::formatHoursWindow` formatter, so the digits stay
identical across every language (translation and formatting kept genuinely
separate, as asked) instead of being duplicated as a separate literal
string per locale.

**Verified**: full manual pass in a real browser across all four languages
— every label/placeholder/button text, a real triggered validation error
(end date before start date) with both the generic banner and the
field-level message confirmed translated in Russian, German, and Czech,
and a complete room-creation round-trip carried out while the UI was set to
German (confirmed the room was created with the correct dates/hours). Also
investigated and ruled out a false alarm: after several rapid
automation-driven locale switches within one long-lived dev-mode browser
tab, the switcher's own option labels transiently corrupted to
English-only names — a fresh `curl` request to the same dev server and a
real (non-client-side) page reload both rendered the labels correctly,
which localized it to stale Next.js client-router-cache state in that one
test tab rather than a bug in `localeDisplayName` or the translation
pipeline. 53 unit + 5 e2e tests green, tsc/eslint clean.

Pushed and redeployed to https://meet.app.julienika.cz; confirmed live in
Russian in a real browser and confirmed the other sites on the shared host
stayed up.

**M3 — room/grid page translated — done** (Owner said "go ahead" after
reviewing M2). Every string across `join-form.tsx`, `app/r/[slug]/page.tsx`'s
header, `availability-grid.tsx`'s brush toolbar and save-state text,
`finalized-banner.tsx`, `leave-room-button.tsx`, and the shared
`new-event-button.tsx` now goes through next-intl in all four languages.
`joinRoom`'s error strings (`app/r/[slug]/actions.ts`) became i18n keys
too — moved into M3 rather than M4 as originally scoped in the milestone
plan, since they render on this page (the join form), not the results
page; the milestone plan is corrected accordingly.

The name-collision "is this you?" flow needed `next-intl`'s `t.rich()`
rather than plain `t()`: the original English had a bolded name embedded
mid-sentence ("**Alice** already has marks in this room:"), and splitting
that into separate translated fragments before/after a hardcoded name
position would produce wrong word order in German/Czech, which put verbs
and the name in different relative positions than English does. `t.rich`
lets the message itself carry a `<b>{name}</b>` placeholder, with the
component supplying `(chunks) => <span className="font-medium">{chunks}</span>`
as the tag renderer, so each language's translator controls where in the
sentence the name goes. The same pattern covers "Marking as **Alice**" on
the room page header.

Two things stayed deliberately untranslated, matching a call made and
logged back at G-002's creation: `lib/slots.ts::formatDayLabel`'s day/month
labels and every hour digit anywhere in the app. These are pinned
formatting (see D2, and the M5 hydration-mismatch bug that's the whole
reason `formatDayLabel` is pinned to `"en-GB"` rather than the runtime
default locale) — making them follow the UI language would mean computing
them via the request's next-intl locale instead, which is *possible*
without reintroducing that specific bug (next-intl's locale is
consistently available both server- and client-side, unlike the original
bug's ambient-runtime-default problem), but the Owner's brief was
explicitly "without messing with formats, just translations," so this was
treated as in-scope-to-leave-alone rather than an oversight to fix. Flagged
in "Next steps" in case that reading is wrong. The IANA timezone picker's
few hundred city names are similarly left in English/IANA form — no
general "translate an arbitrary city name" API exists, and localizing that
list is disproportionate to the ask.

**Verified**: live in a real browser in German and Russian, plus a raw SSR
`curl` check (with `locale` and participant cookies set directly) in Czech
against a seeded finalized-room fixture to reach `finalized-banner.tsx`
without a slow manual walk through the finalize flow. Hit a genuine
testing-environment annoyance along the way: Chrome's own built-in
page-translate feature kept auto-triggering partway through the session
(visible as `translated-ltr` on `<html>` and a `.goog-te-banner-frame`
node) and silently overwrote several screenshots with its own machine
translation of the page — recognizable once noticed by giveaways like
`"7:00 PM"` appearing where the app only ever renders 24-hour `"19:00"`.
Confirmed this was Chrome, not a real bug, two ways: a raw `curl` fetch of
the same URL always showed the genuine server-rendered translation, and a
hard (non-client-side) navigation followed by an *immediate* screenshot
also showed genuine content, before Chrome's translate pass had a chance
to run. 53 unit + 5 e2e tests green, tsc/eslint clean. Pushed and
redeployed to https://meet.app.julienika.cz; confirmed live and confirmed
the other sites on the shared host stayed unaffected.

**M4 — results page translated — done** (Owner said "go ahead" after
reviewing M3). Every string on `results/page.tsx` and `results-board.tsx`
now goes through next-intl: the page header, the heatmap legend, grid cell
tooltips, the Best Times list, and the missing-names line.

The participant count needed more than a simple `t()` call: the original
code was `{totalParticipants} {totalParticipants === 1 ? "person" :
"people"}` — an English-only singular/plural rule that doesn't generalize.
Russian has four plural categories (one/few/many/other — e.g. "1 участник"
/"3 участника"/"5 участников"), Czech has three (one/few/other — "1 osoba"
/"3 osoby"/"5 osob"), German has the same two as English. Rather than
hand-rolling per-locale conditionals, used next-intl's ICU `plural` syntax
directly in the message string (`"{count, plural, one {# person} other {#
people}}"`, with `few`/`many` branches added for ru/cs) — the library picks
the right CLDR plural category for the active locale automatically.
Verified this actually works, not just that it doesn't throw: seeded a
room with exactly 3 participants (a number that lands in Russian's and
Czech's `few` category, not their `other`/default) and confirmed via raw
SSR that Russian renders "3 участника" and Czech "3 osoby", not the
generic form.

`selectFinalSlot`'s error strings (`app/r/[slug]/actions.ts`) became i18n
keys, the same pattern as `createRoom`/`joinRoom`. `deselectFinalSlot`'s
and `saveAvailability`'s error strings were deliberately left in English —
grep-checked both call sites and confirmed neither actually renders the
returned error to the user (both discard it after checking `.ok`), so
there's nothing to translate; converting them would be effort spent on
values nobody ever sees.

**Verified**: raw SSR `curl` checks (locale + participant cookies set
directly) across all four languages against a seeded 3-participant, mixed-
availability fixture (one CANNOT, one preferred CAN, one plain CAN) —
confirmed the page title, pluralized participant count, participant list,
edit link, heatmap legend, grid cell tooltips (base + preferred + cannot
segments all composing correctly), Best Times heading/empty-state/pick-
button text, the "everyone" full-group badge, and the missing-names line
all render correctly in every language, not just English. 53 unit + 5 e2e
tests green, tsc/eslint clean. Pushed and redeployed to
https://meet.app.julienika.cz; confirmed live and confirmed the other
sites on the shared host stayed unaffected.

This closes out G-002's page-by-page translation work (M1-M4 all done).

**M5 — final QA & deploy — done** (Owner said "go m5"). Ran one complete
real end-to-end flow in German — the most structurally complex of the four
languages (compound words, `t.rich` usage, ICU plurals) — rather than
re-testing every string in isolation again (already done exhaustively
across M1-M4): created a room, joined as two participants, painted
CAN/CANNOT/preferred availability, viewed results (confirming the
CANNOT-ranking feature and the translation work compose correctly
together — the 0-cannot slot correctly outranked the 1-cannot slot despite
the latter having a preferred star), finalized a meeting time as the
creator, confirmed the very-visible banner, cleared the selection, and
left the room, confirming ownership auto-transferred to the remaining
participant. Every step was verified against actual Postgres rows, not
screenshots — necessary because Chrome's own translate feature (see M3/M4)
kept auto-corrupting the visible page mid-session in ways a screenshot
alone couldn't distinguish from a real bug; a raw DB check has no such
ambiguity.

Also ran an automated sweep (a one-off Node script, not a permanent test —
this kind of file-level parity check didn't warrant a new dependency or
CI step for a one-time verification) comparing all four `messages/*.json`
files: flattened every namespace, confirmed all 97 keys exist in every
locale with none missing or extra, and flagged any value identical across
locales as a possible untranslated leftover. Only two flagged, both
correct as-is: `Metadata.title` ("When We Meet" — a proper noun, not
translated anywhere, by design) and German's `CreateRoom.optional`
("(optional)" — genuinely the same word in German, not an oversight).

Updated `README.md`'s "Current state" section to describe both G-001 and
G-002 (previously only described the original scheduling-tool build; a
reader would have had no idea multi-language support existed).

Full suite green as the final sign-off baseline: `npx tsc --noEmit` clean,
`npx eslint .` clean (same two pre-existing, unrelated warnings as every
other round), 53 Vitest unit tests, 5 Playwright e2e specs. Pushed and
redeployed to https://meet.app.julienika.cz; confirmed live and confirmed
the other sites on the shared host stayed unaffected.

**G-002's full milestone plan (M1-M5) is now complete.** Per OPERATIONS.md's
definition of done, the goal's status stays `ACTIVE` (not moved to
Completed) pending explicit Owner sign-off — the same pattern G-001
followed after its own M5.

**Bug found and fixed post-sign-off-pass: Geist font was never actually
applied to `body`, in any language** (Owner noticed: "why does the Russian
page look smaller?"). Root cause predates G-002 — `app/globals.css`'s
`body` rule hardcoded `font-family: Arial, Helvetica, sans-serif;`, a
literal value that completely shadowed the `--font-sans` variable
`layout.tsx`'s Geist setup feeds (`@theme inline`'s `--font-sans: var(--font-geist-sans)`,
correctly present on `<html>` the whole time — confirmed via
`getComputedStyle`, which showed `<html>`'s class list had the Geist
variable classes, but `body`'s *computed* `font-family` was still the
literal Arial fallback chain, meaning nothing had ever actually consumed
the variable). The app had therefore always been rendering in whatever
generic sans-serif the browser/OS substitutes for "Arial" — including in
English — but this only became visually *obvious* once Russian shipped:
on this server's Linux rendering environment, that Arial substitute's
Cyrillic glyphs render at noticeably different (smaller-looking) metrics
than its Latin ones, while Geist's own cyrillic subset (added in G-002 M1,
and until now silently never actually used) is metric-matched to its
latin glyphs. Fix: `body { font-family: var(--font-sans), Arial, Helvetica, sans-serif; }`
— one line, keeps the same fallback chain as the ultimate safety net,
makes Geist actually render everywhere it always should have. Verified via
`getComputedStyle(document.body).fontFamily` before/after in a real
browser (both locally and on production) — confirmed `"Geist, \"Geist
Fallback\", Arial, Helvetica, sans-serif"` now resolves for every locale,
not just the Arial fallback. tsc/eslint/53 unit/5 e2e all green. Pushed
and redeployed; confirmed live and confirmed the other sites on the shared
host unaffected.

**Second, related bug found immediately after**: the Geist-font fix above
didn't fully explain what the Owner was seeing — they reported `1rem`
measuring 16px on the English page but 15px on the Russian one. First
guess (Chrome's translate feature adjusting font-size on translated pages,
plausible given how much translate had interfered with this session's own
QA — see M3/M4) turned out wrong: the Owner reproduced it on **Firefox**,
which rules out a Chrome-specific cause. Real cause: browsers can carry a
different *default* root font-size per writing script — Firefox
specifically exposes this under Settings → Fonts → Advanced, with
independent size settings for Latin vs. Cyrillic vs. other scripts — and
since `app/globals.css` never set `html`'s `font-size` explicitly, the
root size (and therefore every `rem`-based measurement in the whole app)
was silently at the mercy of whichever per-script default happened to be
active for the page's language. Fixed by pinning `html { font-size: 16px;
}` explicitly, removing that dependency regardless of which browser or
per-script setting would otherwise have caused it. tsc/eslint/53 unit/5
e2e all green; pushed and redeployed; confirmed live and confirmed the
other sites on the shared host unaffected.

## Git remote & deployment (post-M5, Owner-directed, 2026-08-17)

**GitHub**: `origin` is `git@github.com:yunniko/when-we-meet.git`, pushed
(Owner confirmed). Commit authors were rewritten (`git filter-branch
--env-filter`, all 8 commits at the time) from the local git config's email
to `29886186+yunniko@users.noreply.github.com` — GitHub was rejecting the
push over its "block command-line pushes that expose my email" privacy
setting. This was a one-time history rewrite before anything had been
pushed (safe — no shared history existed yet to disrupt); it was **not** a
`git config` change, which stayed off-limits per the standing "never update
git config, even on request" rule — the Owner was pointed at the one-line
`git config --global user.email ...` to run themselves if they want new
commits to carry that address by default too (not done as of this writing;
new commits will still show the old config's email unless they run it).

**Live deployment**: **https://meet.app.julienika.cz** — a real production
deployment on a shared VPS (`62.171.183.241`, hostname `vmi2520899`) that
also hosts several unrelated sites (`craftale.eu` / listing-studio,
`julienika.cz`, `canis-lunaris.julienika.cz`, `pid.app.julienika.cz`, etc.).
Set up by directly mirroring how `listing-studio` (the closest analog — same
stack, same portfolio) is deployed there:

- Code lives at `/var/www/repositories/when-we-meet` on the server (cloned
  over HTTPS — the `claude_remote` account's SSH agent isn't set up for
  GitHub's SSH host, HTTPS clone worked fine since the repo is public).
  `.env` there sets `APP_URL="https://meet.app.julienika.cz"` and the same
  `DATABASE_URL` as local dev (each project's Postgres is only exposed on
  `127.0.0.1`, so multiple projects' `wwm`/`listing` databases coexist fine
  on the same host).
- `docker compose --profile app up -d --build` (identical to the local
  Docker workflow, see README) builds and runs `db` + `migrate` (one-shot)
  + `app` (`127.0.0.1:30010`, host port kept as-is from the repo's own
  `docker-compose.yml` — confirmed free on this host before deploying,
  no collision with listing-studio's `30000`/`54320`/`63790` or anything
  else listening) + `cleanup` (the expiry sweep, `restart: unless-stopped`,
  loops daily — see D6/AGENTS.md).
- nginx: `/etc/nginx/sites-available/meet.app.julienika.cz`, a plain
  `proxy_pass http://127.0.0.1:30010` vhost (same shape as
  `craftale.eu`'s), symlinked into `sites-enabled`, SSL issued via
  `certbot --nginx` (same as every other `*.julienika.cz` site on this box).
  DNS for `meet.app.julienika.cz` already resolved to this server before
  any of this — presumably a wildcard `*.app.julienika.cz`/`*.julienika.cz`
  record from earlier sites; nothing was changed there.
- Every step needing root (adding `claude_remote` to the `docker` group so
  container builds don't need sudo each time; writing the nginx vhost;
  `certbot`) was done by the Owner directly, following an exact command
  list handed to them — per the "for sudo operations ask my assistance"
  instruction and the charter's escalation rule for anything leaving the
  workspace/touching shared infrastructure. `claude_remote` still has no
  passwordless `sudo`; any future privileged step (new domain, cert
  renewal issues, etc.) needs the same ask-first pattern.
- **Verified**: full smoke test in a real browser against the live HTTPS
  URL (create room → join → drag-paint availability with no gaps → results
  heatmap correct, including the creator-only "click a slot to finalize"
  hint) — not just a health-check ping. Confirmed the other four sites on
  the shared host (`craftale.eu`, `julienika.cz`,
  `canis-lunaris.julienika.cz`, `pid.app.julienika.cz`) still respond 200
  after the change. Confirmed all three containers use
  `restart: unless-stopped` (survive a host reboot). Test room cleaned up
  from the production database afterward.
- **Redeploying**: from `/var/www/repositories/when-we-meet` on the server,
  `git pull && docker compose --profile app up -d --build` (same pattern as
  listing-studio's `make deploy`; no `Makefile` was added here since it's a
  single copy-pasteable line, but consider adding one if this becomes a
  recurring manual step).

**Not started yet:** nothing from the original G-001 acceptance criteria —
all five milestones are done, and the app is now live. Open items are the
"known gap" above, the still-outstanding real-touch-device check (M2/M4),
and whatever the Owner wants next (the participant-profile idea flagged
earlier remains a documented future direction, not started).

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
- `i18n/request.ts` / `lib/ui-locales.ts` / `lib/locale-actions.ts` /
  `app/locale-switcher.tsx` + `app/locale-select.tsx` — the multi-language
  plumbing; see D8 for why this exact shape (copied from listing-studio).
  `messages/{en,ru,cs,de}.json` are the translation files, English always
  the complete source of truth every other locale falls back to per-key.

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

### D8 — Multi-language UI reuses listing-studio's next-intl pattern; fixed 4-locale set, not env-driven (2026-08-17)
**Why:** G-002 (Owner request: EN/RU/CZ/DE UI). Per STANDARDS.md "minimize
spread," surveyed `listing-studio` before picking an approach — it already
solved this exact problem (`next-intl`, cookie-based locale, no URL
segment, English-fallback deep-merge for partial translations, a `key`-remount
fix for a `<select>`-staleness bug) — so this project copies that pattern
rather than inventing a new one. Copied as-is: `next-intl@^4.13.1`,
`i18n/request.ts` (cookie → locale, `mergeMessages` fallback),
`lib/locale-actions.ts` (`setLocaleAction`), the switcher's server/client
split (`app/locale-switcher.tsx` + `app/locale-select.tsx`, the latter using
listing-studio's exact `key={current}` remount trick). **Deviated on one
point:** listing-studio's `enabledUiLocales()` is env-driven
(`UI_LANGUAGES`), built for *staging in* languages incrementally as
translations land. This project was asked for a fixed set (EN/RU/CZ/DE) with
no staged-rollout requirement, so `lib/ui-locales.ts::enabledUiLocales()`
returns a hardcoded four-element array instead of parsing an env var —
simpler, and there's nothing to configure. The English-fallback
`mergeMessages` behavior is kept identically, so an individual locale can
still ship with partial translation coverage without breaking.
**Considered:** URL locale segments (`/ru/r/slug`) — rejected for the same
reason listing-studio's D2 rejected it, doubled here by an app-specific
concern: room URLs are shared between people who may prefer different
languages, and a locale segment would make the *same room* resolve to
different-looking URLs depending on who generated the link, which is a
worse fit for this app than for listing-studio's marketing pages. Locale
stays a pure display preference, cookie-only, completely orthogonal to
`Room.timezone` (D2) and the room's URL/slug.
**Font note:** `next/font/google`'s Geist/Geist Mono default to a
`latin`-only subset; added `latin-ext` (Czech/German diacritics) and
`cyrillic` (Russian) — without this, Cyrillic text would silently fall back
to a system font instead of rendering in Geist.

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

1. **All five milestones (M1-M5) are done, verified, pushed, and deployed
   live** at https://meet.app.julienika.cz (see "Git remote & deployment").
   G-001's original acceptance criteria are all met. Every round of
   post-launch changes since (weekend shading/sticky-header, leave-room +
   ownership transfer, daily-time-window presets, Best Times missing-names,
   CANNOT-count ranking, join-page clarity, 100-participant cap) is
   committed, pushed, and live on production as of this writing.
1a. **G-002 (multi-language UI) — all five milestones done.** The entire
    app is translated into English, Russian, Czech, and German, verified
    end to end (including one complete real multi-participant flow driven
    entirely in German, DB-checked at every step) and deployed live.
    Status stays `ACTIVE` pending explicit Owner sign-off — see the M5
    HANDOVER entry above.
1b. **Flag for the Owner**: day/month labels and hour digits are
    deliberately left unlocalized everywhere (still always "Tue 5 Oct",
    "14:00" regardless of UI language) — read as in-scope for "without
    messing with formats, just translations." If that reading's wrong and
    day/month names should follow the UI language too, it's a contained
    change (next-intl's locale is available consistently server- and
    client-side, so it wouldn't reintroduce the hydration-mismatch bug
    that's the reason `formatDayLabel` is pinned to `"en-GB"` today) — just
    not started, since the brief read as "leave formats alone."
2. **Missing test coverage**: the creator-leaves-and-ownership-transfers
   case (see "Post-launch UX round" above) was verified manually
   (real browser + SQL check) but has no automated e2e spec yet. Worth
   adding to `tests/e2e/leave-room.spec.ts` if this area sees more changes.
   The 100-participant cap (see "CANNOT-ranking, join-page clarity, and a
   participant cap" above) is similarly manual-only.
3. **Resolved**: the CAN/CANNOT-inference design question (previously open
   here) was settled — see "CANNOT-ranking, join-page clarity, and a
   participant cap" above. Ranking now factors in explicit CANNOT counts;
   unmarked slots stay uninferred either way.
4. Open questions/flags for the Owner, none blocking:
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
