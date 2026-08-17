# Goals — when-we-meet

Owner writes goals here; The Company plans, executes, and logs against them.
Statuses: `DRAFT` (not ready to start) · `ACTIVE` · `BLOCKED` · `DONE`.
Template for a new goal, company-wide numbering, and cross-project conventions
live in `E:\CLAUDE\COMPANY\GOALS.md`.

---

## Active goals

### G-001 · when-we-meet — ACTIVE
- **What:** A web service where one person ("organizer") creates a planning
  room by choosing a date range to plan over (optionally a strict daily time
  window, e.g. for an event with fixed opening hours) and gets a unique,
  unguessable URL for the room. Anyone with the URL can join under a display
  name (no account/login) and mark, in 1-hour slots, which times they CAN or
  CANNOT do across the room's range, plus an optional separate layer marking
  which of their available times they'd *prefer*. The app computes and shows
  the times when everyone overlaps, with preferred-time overlaps surfaced at
  the top. Identity within a room is a browser cookie; if a visitor without a
  cookie types a name that's already used in that room, they're shown that
  name's existing marks and asked "is this you?" before taking it over — no
  passwords, the group is trusted not to mess with each other's entries.
- **Why:** Give small friend groups a fast, frictionless way to find a time
  that works for everyone, without anyone needing to create an account.
- **Acceptance criteria:**
  1. Anyone can create a room: start date, end date, optional daily time
     window (e.g. 09:00–17:00) applied every day in range, single fixed
     timezone for the whole room (set at creation). Creating a room returns a
     unique shareable URL immediately, no login required.
  2. Opening the room URL lets a visitor enter a display name and mark
     availability on an interactive grid of 1-hour slots spanning the room's
     date range and daily time window, using CAN / CANNOT (default: unmarked
     = unknown, not "cannot"). Works with drag-to-paint on desktop and touch
     on mobile.
  3. A separate, optional "preferred" layer lets a participant mark which of
     their own CAN slots they'd prefer — can't prefer a slot not marked CAN.
  4. A results view shows, across the whole room, which slots the most
     people are free for; slots where *everyone* is free are highlighted;
     among equally-available slots, ones with more "preferred" marks sort to
     the top.
  5. Revisiting the room URL in the same browser (cookie present) shows the
     participant their own name and prior marks, editable at any time — no
     re-entry of name needed.
  6. Revisiting without a cookie (new browser/device) and entering a name
     that already exists in that room shows that name's current marks and
     asks "is this you?" — confirming takes over editing that identity
     (sets a fresh cookie); declining lets them pick a different name.
  7. No account system, no password, no per-user auth beyond the
     name+cookie convention above — this is an explicit, documented trust
     model, not an oversight.
  8. Usable on a phone screen, not just desktop.
  9. The room's creator can mark a specific day+time as the finalized
     meeting slot; this is shown very visibly on the room page to everyone
     (joined or not); once set, marking availability is closed to everyone
     until the creator clears the selection (which they can do at any
     time). A slot can only be selected if it's in the future.
  10. A room (and everyone's marks in it) is automatically removed 3 days
      after its finalized meeting date, or 3 days after the planning
      range's end date if nothing was ever finalized.
- **Constraints:** no deadline; budget = none (no paid services); stack is
  JulAI's choice, reviewed by Owner at first check-in. No accounts, no
  external services, no payments — this project needs none of those.

**Scope decisions** (clarified with Owner 2026-08-17):
  - Time granularity: 1-hour slots (not 30-min, not whole-day-only).
  - Timezone: single implicit timezone per room, set once at creation; all
    participants mark and view in that same wall-clock time. Per-participant
    timezone conversion is explicitly out of scope (documented trust/simplicity
    trade-off, matches "friends coordinating one meetup" framing).
  - Project name: when-we-meet.
  - Creator/"finalize the meeting time" permission (added mid-M5, Owner
    request): tied to a *participant identity*
    (`Room.creatorParticipantId`), not a separate cookie, specifically so
    it's recoverable across devices via the same name-collision "is this
    you?" flow participant identity already uses — see HANDOVER D7. This
    also confirms the creator marks their own availability exactly like any
    other participant (they must join normally to be recognized).
  - Room expiry (added mid-M5, Owner request): 3 days after the finalized
    date, or 3 days after the range end if never finalized; a coarse
    UTC-calendar-day policy, not timezone-precise (see HANDOVER D6) —
    enforced lazily on access plus a standalone cleanup script/service.

**Milestones** (filled in by The Company during planning):
- [x] M1 — Foundation: Next.js/TS/Prisma/Postgres scaffold running locally
      (Docker for Postgres, `npm run dev` for the app), data model (Room,
      Participant, Availability), room creation flow (date range + optional
      daily time window + timezone), unique unguessable room URL. README and
      HANDOVER stubs in place. ✔ 2026-08-17, commit (initial commit, see git
      log). Verified: created a room through the real UI in a browser,
      confirmed the DB row, confirmed the redirect and rendered room page,
      confirmed 404 on an unknown slug; `tsc --noEmit` and `eslint` clean.
- [x] M2 — Join & mark availability: name entry with cookie-based identity,
      name-collision "is this you?" prompt (shows existing marks), interactive
      1-hour-slot grid with drag-to-paint CAN/CANNOT, mobile touch support,
      save/load a participant's own marks. ✔ 2026-08-17. Verified: full flow
      driven in a real browser (join as new name, drag-paint CAN and CANNOT
      strokes, confirm DB persistence, leave and rejoin with a
      different-case name to trigger the collision prompt, confirm identity,
      confirm a second distinct name joins cleanly alongside the first).
  - [x] M3 — Preferred layer + results: optional "preferred" marking layer
      constrained to a participant's own CAN slots; overlap computation across
      all participants; results view ranking slots by availability count with
      full-group and preferred-overlap slots surfaced at the top. ✔ 2026-08-17.
      Verified: seeded a second participant's marks directly in Postgres,
      joined as a new participant in a real browser, painted overlapping CAN
      slots plus one Prefer mark, confirmed the Prefer brush is a no-op on
      non-CAN cells, confirmed exact DB rows, opened the results page and
      confirmed the heatmap intensity/full-group ring/preferred badge and the
      "Best times" ranking (canCount desc, then preferredCount desc) all
      matched.
- [x] M4 — Edge cases & polish: strict single-day/fixed-hours event mode,
      always-editable own marks, empty/error states (room not found, name
      taken by a *different* confirmed identity mid-session), responsive/mobile
      pass, basic abuse-resistance (token unguessability, no enumeration).
      ✔ 2026-08-17. Verified: single-day fixed-hours room created and joined
      through the real UI (fixed a redundant "2026-09-05 – 2026-09-05" date
      display in the process); the join-name-race condition reproduced
      directly against Postgres (concurrent `create()` calls confirmed one
      throws `P2002`) and the recovery path exercised via the ordinary
      collision flow; 404s confirmed for unknown room and results URLs;
      results-without-joining confirmed to redirect to the join form; a
      narrow-viewport (390×844) pass via an emulated iframe viewport found no
      horizontal overflow on any of the three pages, and touch-target sizing
      was bumped (grid cells 32px → 40px, brush buttons more padding);
      timezone picker regrouped into region `<optgroup>`s instead of one flat
      ~400-entry list. Room-slug and cookie-token entropy reviewed — no
      changes needed, already adequate (documented in HANDOVER D4).
- [x] M5 — Testing & sign-off: unit tests for the overlap/ranking algorithm,
      Playwright e2e for create → join → mark → view-results and the
      name-collision flow, manual verification of the running app, README/
      HANDOVER finalized. ✔ 2026-08-17. Scope grew mid-milestone at the
      Owner's request to include acceptance criteria 9-10 (finalize the
      meeting time; room expiry) — both built and covered by the same test
      suite. 40 Vitest unit tests (`lib/slots`, `lib/results`,
      `lib/validation`, `lib/time`, `lib/expiry`) + 4 Playwright e2e specs
      (create/join/mark/results, name-collision confirm+decline,
      finalize/lock/clear), all green. Found and fixed a real bug via this
      suite: `formatDayLabel` used the runtime-default locale, which
      differed between the Next.js server and the browser and caused a
      genuine React hydration mismatch — pinned to `"en-GB"`. Manually
      verified: full finalize flow in a real browser (creator-only pick
      controls, very-visible banner shown to a cookie-less `curl` visitor
      too, grid locked for everyone, clear reopens it); room expiry's
      lazy-deletion mechanics (inserted a 2020-dated room directly in
      Postgres, confirmed it 404s and the row is actually gone).
      tsc/eslint clean throughout.

**Progress log** (newest first; The Company appends at every stopping point):
- 2026-08-17 — **M5 done — all five milestones complete, G-001 functionally
  done.** Built the test infrastructure (Vitest + Playwright, see M5 entry
  above) and, at the Owner's request mid-milestone, two new features now
  covered by it: (1) the room creator can pick/clear a finalized meeting
  slot (creator permission tied to a participant identity so it's
  recoverable across devices — see HANDOVER D7 for why that design was
  chosen over the initial standalone-cookie approach); (2) rooms expire and
  are deleted 3 days after the finalized date or the range end (HANDOVER
  D6), enforced lazily on access plus a standalone `npm run cleanup`
  script/docker-compose service. Found and fixed a genuine bug via the new
  e2e suite: a locale-dependent date-formatting hydration mismatch between
  server and client. Added `git remote origin` pointing at the Owner's
  supplied GitHub URL (`git@github.com:yunniko/when-we-meet.git`) —
  **not pushed**, awaiting explicit Owner go-ahead per VALUES.md before
  anything leaves the workspace. 40 unit + 4 e2e tests, all green;
  tsc/eslint clean throughout. **Stopping here for Owner review** — this is
  the last planned milestone; further work is Owner-directed from here.
- 2026-08-17 — **Visual redesign (Owner-directed, post-M4).** Owner asked
  for a light theme and supplied a hand-drawn/crayon illustration
  ("WHEN WE MEET,♥" — four friends toasting, with a starred weekly
  calendar) for the room-creation page. Removed dark mode entirely (was
  automatic via `prefers-color-scheme`) rather than maintaining a second
  palette nobody asked for; replaced it with a single warm cream/orange
  theme (tokens in `app/globals.css`, rationale in HANDOVER D5). Added the
  image as `assets/hero-when-we-meet.jpg` and made it the landing page's
  hero via `next/image`. Every page now sits in a rounded warm-bordered
  card on the cream background. Verified end to end in a real browser
  (create room → join → paint availability → view results) against the new
  theme; tsc/eslint clean; test data cleaned up. Not a milestone in the
  original plan — logged here as Owner-directed work within G-001, per
  OPERATIONS.md "log significant decisions with rationale."
- 2026-08-17 — **M4 done and verified.** Fixed a real (if rare) bug: two
  people submitting the same brand-new name at nearly the same instant could
  both pass the "does this name exist" check before either committed, so the
  second `participant.create()` would hit the (roomId, nameKey) unique
  constraint and surface as an unhandled 500 instead of the intended
  collision prompt. `joinRoom` now catches `Prisma.PrismaClientKnownRequestError`
  with code `P2002` and recovers by re-fetching the now-existing participant
  and returning the same collision state as the ordinary case. Verified the
  exact Prisma error shape directly against Postgres (two concurrent
  `create()` calls — one fulfills, one rejects with `P2002`) since forcing
  the precise race through two real HTTP requests via browser automation
  wasn't reliably reproducible; the recovery code path itself (shared
  `collisionState` helper) was exercised through the ordinary, non-raced
  collision flow. Confirmed the single-day/fixed-hours event mode reads well
  end to end and fixed a redundant date-range display it exposed
  ("2026-09-05 – 2026-09-05" → "2026-09-05"). Confirmed 404s for unknown
  room/results URLs and the results-without-joining redirect. Did a
  narrow-viewport pass (390×844, via an emulated iframe since the browser
  tool's window resize wasn't taking effect in this environment) across the
  create-room, join, grid, and results pages — no horizontal overflow found;
  bumped touch-target sizing (grid cells and brush buttons) as a precaution
  since real touch-device testing is still an open item (see M2). Regrouped
  the timezone `<select>` into region `<optgroup>`s. Reviewed slug/token
  entropy — adequate, no changes. tsc/eslint clean. Test data cleaned up.
  **Stopping here per OPERATIONS.md milestone checkpoint — awaiting Owner
  review before starting M5** (automated tests & sign-off).
- 2026-08-17 — **M3 done and verified.** Grid gained a fourth brush,
  "Prefer", which only applies to a participant's own CAN slots (server-side
  clamp in `saveAvailability` too — never trust the client for that
  invariant); a whole drag stroke sets-or-clears "preferred" uniformly,
  decided from the first cell touched, so a mixed-state drag doesn't flip
  cells independently of each other. New pure `lib/results.ts::computeResults`
  aggregates every participant's `Availability` rows into per-slot
  can/cannot/preferred counts and ranks slots (canCount desc, preferredCount
  desc, then chronological). New `/r/[slug]/results` page (gated behind
  having joined, like the grid): a read-only heatmap (green intensity =
  fraction of the group who can, amber ring = everyone can, star badge =
  preferred count) plus a "Best times" ranked list. Verified end to end:
  seeded a second participant directly in Postgres, joined as a new
  participant in a real browser, drag-painted overlapping CAN slots and one
  Prefer mark, confirmed clicking Prefer on an unmarked cell is a true no-op
  (no DB row created), confirmed exact Postgres rows, then opened the
  results page and confirmed the heatmap and the "Best times" ranking both
  matched by hand-checking the numbers. tsc/eslint clean throughout. Test
  data cleaned up. **Stopping here per OPERATIONS.md milestone checkpoint —
  awaiting Owner review before starting M4** (edge cases & polish).
- 2026-08-17 — **M2 done and verified.** Cookie-based participant identity
  (httpOnly cookie per room, keyed by roomId, holding an opaque token — not
  the participant id). Join flow: new name creates a Participant immediately;
  an existing name (case/whitespace-insensitive match) shows that name's
  current marks grouped by date and asks "is this you?" before claiming the
  identity — declining just clears the prompt so a different name can be
  tried. Availability grid: brush-based painting (Can / Can't / Clear) using
  pointer events (mouse+touch unified) with drag support; a stroke's changes
  batch-save via one server-action call on pointer-up. Found and fixed a real
  bug during verification: fast drags could skip intermediate cells between
  pointerenter events (reproduced with the browser automation tool, plausible
  on touch too) — fixed by interpolating along the grid between the last and
  current painted cell. Verified end to end in a real browser: join as new
  name, drag-paint CAN and CANNOT strokes (confirmed no gaps and correct
  Postgres rows), leave and rejoin under a different-case version of the same
  name to trigger the collision prompt, confirm identity via "yes that's me"
  and confirm marks reload correctly, and a second genuinely-new name joins
  cleanly and sees the first participant listed. tsc/eslint clean. Not
  physically tested on a real touch device (browser automation simulates
  mouse) — the pointer-event approach is the standard technique for
  unifying mouse/touch and should generalize, flagged in HANDOVER as unverified
  on real hardware. **Stopping here per OPERATIONS.md milestone checkpoint —
  awaiting Owner review before starting M3** (preferred layer + results
  ranking).
- 2026-08-17 — **M1 done and verified.** Scaffolded Next.js/TS/Tailwind (matches
  listing-studio's create-next-app defaults) + Prisma 7/PostgreSQL (Docker,
  port 54321). Data model: Room, Participant, Availability — availability
  slots are plain (date, hour) pairs, deliberately never converted through
  Date/timezone math (HANDOVER D2). Room creation flow built end to end
  (landing form -> server action -> unguessable 12-char slug -> DB row ->
  redirect to /r/[slug]) and verified by actually driving it in a browser
  (claude-in-chrome): submitted a room with a custom daily window, confirmed
  the redirect, the rendered page, the Postgres row, and a 404 on an unknown
  slug; test data cleaned up afterward. tsc/eslint clean. Git repo
  initialized, first commit made. Also noted for future scope (not building
  now): the Owner wants to eventually support participant profiles with a
  reusable default-availability template — current schema doesn't block this,
  see HANDOVER "Future direction". **Stopping here per OPERATIONS.md milestone
  checkpoint — awaiting Owner review before starting M2** (join flow +
  availability grid).
- 2026-08-17 — Goal created and planned with the Owner (granularity, timezone,
  and project-name decisions made via clarifying questions). Stack decision:
  followed portfolio precedent (TypeScript/Next.js/PostgreSQL/Prisma, per
  listing-studio D1) minus the pieces this project doesn't need (no Auth.js,
  no Redis/BullMQ, no Stripe — no accounts/payments/queues here).
