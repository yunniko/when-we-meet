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
- 2026-08-20 — **Mobile layout fixes**, Owner-directed (three bugs reported
  with screenshots: misaligned "New event" button, overflowing brush
  toolbar, chaotic Best Times list). Reproduced with real Playwright
  device emulation (Pixel 5) since neither `resize_window` nor the usual
  iframe-emulation trick works anymore — the latter is now correctly
  blocked by this project's own clickjacking CSP from the security-review
  round. Root cause all three: flex layouts that never accounted for
  content wrapping on narrow screens (a shrink-to-fit `text-right` block
  landing off-center once wrapped, a button row missing its own
  `flex-wrap`, and Best Times rows fighting to stay side-by-side at every
  width). Fixed with standard responsive stacking patterns. 55 unit + 5
  e2e green; pushed and redeployed; confirmed live and confirmed other
  sites on the shared host unaffected.
- 2026-08-19 — **Status page**, Owner-directed. `/status?key=...` shows
  room/participant counts and a paginated, newest-first room list
  (title/created/active-or-expired/participant count). Since this is a
  real departure from the app's otherwise-unenumerable design (D4), asked
  the Owner how to gate it before building rather than picking myself —
  they chose a shared-secret query token over Basic Auth or leaving it
  public. Caught a real deploy-path bug before it became a live issue:
  `docker-compose.yml` doesn't forward the host `.env` wholesale, so
  setting the token only on the server's `.env` would have silently done
  nothing until `STATUS_PAGE_TOKEN` was also added to the `app` service's
  explicit environment list (same pattern `APP_URL` already needed).
  Verified via curl (no/wrong/right key → 404/404/200) and a seeded
  already-expired room rendering correctly on its (last) page. Full suite
  green; pushed and redeployed across two rounds (page, then the
  docker-compose fix); confirmed live in production.
- 2026-08-18 — **Security review**, Owner-directed ("my friend is a strong
  programmer, what vulnerabilities could he find?"). Reviewed the actual
  code: no SQL injection surface (Prisma only, no raw queries), no XSS
  vector (no `dangerouslySetInnerHTML`, React's default escaping covers
  the only free-text user input), httpOnly/secure cookies, every server
  action re-verifies authorization server-side. Flagged (not fixed, by
  design) that the app has no authentication — anyone with a room link who
  knows a participant's name can claim their identity via the ordinary
  collision flow, the documented G-001 trust model. Found and fixed two
  real gaps: no clickjacking protection (added X-Frame-Options/CSP
  frame-ancestors/nosniff/Referrer-Policy headers) and an unbounded slots
  array in `saveAvailability` (capped at 1500, pinned to the room grid's
  own theoretical max). Restated the already-known, unchanged
  no-rate-limiting gap (D4). Full suite green; pushed and redeployed;
  confirmed other sites on the shared host unaffected.
- 2026-08-17 — **CANNOT-ranking, join-page clarity, and a 100-participant
  cap**, Owner-directed, pushed and redeployed live (two rounds). Owner
  asked whether unmarked slots should be inferred as CAN/CANNOT based on
  how a participant used the two brushes — recommended against it as
  fragile (a slot's meaning shouldn't depend on someone else's marking
  habits) and proposed factoring explicit CANNOT counts into the ranking
  instead, which the Owner agreed to: `computeResults` now ranks a slot
  with fewer explicit CANNOTs above an equally-CAN slot with more, verified
  live (seeded two equal-CAN slots with different cannot counts, confirmed
  the zero-cannot one ranked first despite being chronologically later) and
  with a new unit test. Owner then asked for more context on the join/name
  page — it previously showed only the room title; now shows the date
  range/hours/timezone and a short explanation of what joining does,
  before the visitor types anything. Owner also asked whether room
  participant counts are limited (they weren't) and whether reCAPTCHA would
  help — recommended against reCAPTCHA (needs a Google account, adds
  friction to every real join, works against the app's frictionless-by-design
  goal) in favor of a flat cap: rooms now reject new joins past 100
  participants (`lib/validation.ts::MAX_PARTICIPANTS_PER_ROOM`), verified by
  seeding exactly 100 participants directly in Postgres and confirming a
  101st join is rejected while reclaiming an existing name still works.
  47 unit + 5 e2e tests green, tsc/eslint clean throughout. All test rooms
  cleaned up from local dev and production afterward.
- 2026-08-17 — **Daily time-window presets + Best Times missing-names**,
  Owner-directed, pushed and redeployed live. Room creation's "whole day"
  checkbox replaced with five radio presets (Evening/Whole day/Morning/
  Midday/Custom, `lib/room-presets.ts`). Found and fixed a real React 19 bug
  along the way, reported by the Owner ("values got reset on error"): the
  preset radio silently reverted to "Evening" after a failed submission
  because React's automatic post-action form reset (tied to a form's native
  `action={fn}` prop) mutates radio `checked` via raw DOM, bypassing React's
  controlled-value tracking entirely — converting to a controlled `checked`
  prop alone did *not* fix it (confirmed by reproducing the bug again with
  that fix applied, live in a browser). Real fix: dispatch the action
  manually via `onSubmit` + `startTransition` instead of the form's native
  `action` prop, which never takes the reset code path at all. Also: Best
  Times entries now list every participant who didn't mark CAN for that
  slot (all names, not truncated — confirmed with the Owner). Verified: bug
  reproduced and fixed live in a browser (before/after), a full valid
  submission confirmed the custom hour range actually applies to the grid,
  46 unit + 5 e2e tests green, tsc/eslint clean. Pushed and redeployed to
  https://meet.app.julienika.cz; confirmed live and confirmed the other
  four sites on the shared host still respond.
- 2026-08-17 — **Redeployed the "post-launch UX round" below** (weekend
  shading, sticky-header fix, join-form clarity, results participant list,
  leave-room + ownership transfer) to https://meet.app.julienika.cz,
  Owner-directed ("push please ... then deploy it"). Also rewrote the one
  new commit since the initial GitHub push with the same per-commit
  `GIT_AUTHOR_EMAIL`/`GIT_COMMITTER_EMAIL` override (global git config still
  carries the original email; the Owner hasn't run the one-line fix for
  that yet, so this override will keep being needed for future commits
  until they do). Confirmed live via browser and confirmed the other sites
  on the shared host were unaffected.
- 2026-08-17 — **Post-launch UX round**, Owner-directed. Weekend columns shaded darker on
  the grid and results heatmap (`lib/slots.ts::isWeekend`, new
  `--color-weekend` token). Found and fixed a real CSS bug along the way:
  the date header row's `sticky top-0` never actually pinned while
  scrolling, because of a CSS Overflow-spec quirk (`overflow-x: auto` with
  no explicit `overflow-y` silently forces `overflow-y: auto` too) that
  turned the grid wrapper into an invisible, non-scrolling scroll
  container with nothing for `position: sticky` to stick against — fixed
  by making the grid a real bounded scroll pane (`max-h-[70vh]
  overflow-auto`) instead. Join screen now explains the name must be
  unique in the room and is needed again to edit marks later, and the
  "already in this room" name list is clickable ("it's me" shortcut into
  the existing collision-confirm flow, not a bypass of it). Results page
  now lists participant names (plain text, intentionally not clickable).
  Added "Leave the room": a destructive, confirmation-gated action
  distinct from "Not you?" — deletes the participant and all their marks.
  Per an Owner decision among three options (forbid / auto-transfer /
  leave ownerless), when the room's creator leaves, creator permissions
  auto-transfer to the next-longest-tenured remaining participant, so the
  room doesn't get stuck unable to finalize a meeting time. Verified: full
  manual browser passes for all of the above, including a DB-level check
  that leaving truly deletes data (not just the cookie) and a real
  ownership-transfer scenario (seeded a second participant, had the
  creator leave, confirmed via SQL the second participant became creator).
  New Playwright spec `leave-room.spec.ts` (cancel/confirm/rejoin-is-fresh);
  the ownership-transfer case itself is manual-only so far, flagged in
  HANDOVER. 43 unit + 5 e2e tests green, tsc/eslint clean.
- 2026-08-17 — **Pushed to GitHub and deployed live**, Owner-directed.
  Rewrote all 8 local commits' author email (`git filter-branch`, not a
  `git config` change — that stays off-limits) to satisfy GitHub's
  email-privacy push protection, then pushed to
  `git@github.com:yunniko/when-we-meet.git`. Deployed to the Owner's shared
  VPS (`62.171.183.241`) as **https://meet.app.julienika.cz**, mirroring
  exactly how `listing-studio` is deployed there (same Docker Compose
  `--profile app` workflow, nginx reverse proxy + Certbot). This is a
  shared host running several unrelated sites — every root-requiring step
  (docker group membership, nginx vhost, SSL cert) was done by the Owner
  directly from an exact command list, never guessed or worked around.
  Verified with a full browser smoke test against the live HTTPS URL
  (create → join → paint → results, including the creator-only finalize
  hint) and confirmed the other four sites on the host still respond
  afterward. See HANDOVER "Git remote & deployment" for the full record.
  **G-001 is now live, not just built** — nothing left from the original
  acceptance criteria; awaiting Owner sign-off to move this goal to
  Completed.
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

---

### G-002 · Multi-language UI (EN/RU/CZ/DE) — ACTIVE
- **What:** All user-facing UI text (labels, buttons, headings, help copy,
  validation/error messages) available in English, Russian, Czech, and
  German, switchable per visitor without affecting date/hour formatting or
  room URLs. English is always the fallback for any string not yet
  translated in another locale, so partial translation coverage never
  breaks the app.
- **Why:** Owner request — the app currently only speaks English, which
  limits who can actually use it.
- **Acceptance criteria:**
  1. A language switcher, visible on every page, lets a visitor pick
     EN/RU/CZ/DE; the choice persists across navigation and return visits
     (cookie-based, no login).
  2. Switching language does not change the room's URL/slug, and does not
     change how dates/hours are stored, computed, or displayed — the
     "everyone marks and sees times in the room's single declared
     timezone, wall-clock, en-GB-formatted" behavior (HANDOVER D2) is
     completely unaffected by UI language.
  3. Every string a visitor can see — landing/create-room page, join page,
     room/grid page, results page, all buttons/banners/error messages — is
     translated in all four languages, with English as an automatic
     fallback for any individual key missing in another locale.
  4. Existing automated test suite (unit + e2e) still passes, exercising
     the app in its default (English) locale.
- **Constraints:** no deadline; budget = none; no new paid/external
  services (rules out any translation-management SaaS — translations are
  authored directly as JSON, same as listing-studio's pattern). Reuse the
  established portfolio pattern from `listing-studio` (`next-intl`,
  cookie-based locale, no URL locale segment) rather than inventing a new
  approach — see HANDOVER decision record for what was reused vs. adapted.

**Milestones**:
- [x] M1 — i18n infrastructure: `next-intl` wired in (config, root layout,
      `next.config.ts`), cookie-based locale resolution with English-fallback
      deep-merge (mirroring listing-studio's `mergeMessages`), a language
      switcher component (with the known `key`-remount fix for the
      `<select>` staleness bug listing-studio already hit and documented),
      and a minimal `messages/{en,ru,cs,de}.json` proving the pipeline
      end-to-end on one real string. No visible page content translated yet
      — this milestone is the plumbing. ✔ 2026-08-17. Verified live in a
      browser (switcher label re-renders per language, cookie persists
      across a real navigation) plus a new unit test
      (`tests/unit/ui-locales.spec.ts`); 53 unit + 5 e2e tests green;
      tsc/eslint clean.
- [x] M2 — Landing/create-room page fully translated in all four languages:
      `app/page.tsx`, `create-room-form.tsx` (including the daily-time-window
      preset labels). Also covers the Zod validation error messages here —
      per listing-studio's actual pattern (confirmed by re-reading its
      source, not just recalled from the earlier survey): schema `.min()`/
      `.refine()` messages are bare i18n KEY strings (e.g. `"nameRequired"`,
      not a sentence), passed through untranslated by the server action, and
      translated client-side as `t(`errors.${key}`)` in a per-form
      namespace. No translator-aware schema factory needed — simpler than
      first planned. ✔ 2026-08-17. Verified live in a real browser in all
      four languages: form labels/placeholders/help text, preset names
      (hour ranges themselves left as locale-invariant digits via the
      existing `formatHoursWindow`), the generic and per-field validation
      errors (triggered a real end-date-before-start-date error and
      confirmed the translated message in RU/DE/CS), and a full room
      creation round-trip while the UI was in German. Browser tab
      title/meta description are now locale-aware too
      (`generateMetadata` in `app/layout.tsx`). 53 unit + 5 e2e tests green,
      tsc/eslint clean.
- [x] M3 — Room pages translated: `join-form.tsx`, `app/r/[slug]/page.tsx`
      (grid header, "Not you?"/"Leave the room"), `availability-grid.tsx`
      toolbar, `finalized-banner.tsx`, `leave-room-button.tsx`,
      `new-event-button.tsx`. ✔ 2026-08-17. Also covered `joinRoom`'s error
      strings here (not M4 as originally scoped — they render on this
      page, so moving them here was the natural boundary). Verified live:
      RU/DE via real browser sessions (Chrome's own auto-translate feature
      repeatedly interfered with screenshots mid-session — confirmed via
      raw `curl` SSR fetches and hard-navigation-then-immediate-screenshot,
      both bypass it and show genuinely correct output) and CZ via a
      seeded finalized-room fixture checked through raw SSR. 53 unit + 5
      e2e tests green, tsc/eslint clean.
- [x] M4 — Results page translated: `results/page.tsx`, `results-board.tsx`,
      plus `selectFinalSlot` error strings (`deselectFinalSlot`'s and
      `saveAvailability`'s errors are never rendered, so left as-is). ✔
      2026-08-17. Participant count uses a real ICU `plural` rule, not an
      English-only singular/other ternary — verified against Russian's and
      Czech's "few" category (3 → "3 участника"/"3 osoby") via raw SSR with
      a 3-participant fixture. 53 unit + 5 e2e tests green, tsc/eslint
      clean.
- [x] M5 — QA & deploy: full manual pass in each of the four languages
      (switch language, create a room, join, mark availability, view
      results, finalize a meeting time, leave a room) confirming no
      untranslated/fallback-to-English text appears anywhere it shouldn't
      and that date/hour formatting is genuinely unaffected by UI language;
      confirm the full automated suite is still green; update README/
      HANDOVER; push and redeploy to https://meet.app.julienika.cz. ✔
      2026-08-17. Ran one complete real end-to-end flow in German (create →
      join as two participants → mark CAN/CANNOT/preferred → view results →
      finalize a meeting time → banner check → clear → leave with
      ownership auto-transfer), each step confirmed against actual
      Postgres state, not just what rendered — necessary because Chrome's
      own translate feature kept auto-corrupting screenshots mid-session
      (see M3/M4 notes); DB-level verification sidesteps that entirely. Also
      ran an automated key-parity sweep across all four `messages/*.json`
      files: all 97 keys present in every locale with no missing/extra
      keys, and no unexpected untranslated leftovers (the only
      identical-across-locales values are the deliberate ones — the
      product name and German's "(optional)," which is genuinely the same
      word in German). tsc/eslint/53 unit/5 e2e all clean as the final
      baseline. README updated with the multi-language summary.

**Progress log** (newest first; The Company appends at every stopping point):
- 2026-08-17 — **Bug fix, post-M5 (follow-up)**: Owner reported 1rem
  measuring 16px on English but 15px on Russian. First guess (Chrome's
  translate feature, given how much it had interfered with this session's
  own QA) turned out wrong — reproduced on Firefox too, ruling that out.
  Real cause: browsers can apply a different default root font-size per
  writing script (Firefox exposes this explicitly under Settings → Fonts →
  Advanced), and `html`'s `font-size` was never set explicitly, so every
  rem-based measurement in the app was at the mercy of whichever
  per-script default the browser happened to be using for the page's
  language. Fixed by pinning `html { font-size: 16px; }` — removes the
  dependency on any browser/script default entirely. Full suite green;
  pushed and redeployed.
- 2026-08-17 — **Bug fix, post-M5**: Owner asked "why does the Russian page
  look smaller?" — traced to `app/globals.css`'s `body` rule hardcoding
  `font-family: Arial, Helvetica, sans-serif`, which had silently shadowed
  the Geist font setup (in every language, not just Russian) since G-002
  M1 added it — Geist's CSS variable was correctly defined on `<html>` the
  whole time, just never actually consumed anywhere. Only became visually
  obvious for Russian because the Arial-substitute font this server falls
  back to renders Cyrillic at different metrics than Latin, while Geist's
  matched cyrillic subset (added in M1, unused until now) doesn't have
  that problem. One-line fix routing `body`'s font through
  `var(--font-sans)` first. Verified via `getComputedStyle` before/after
  locally and on production; full suite green; pushed and redeployed.
- 2026-08-17 — **M5 done** (Owner said "go m5"). Final QA pass: one
  complete real end-to-end flow driven in German (create a room → join as
  two participants → mark CAN/CANNOT/preferred availability → view
  results → finalize a meeting time as the creator → confirm the banner on
  the room page → clear the selection → leave the room, confirming
  ownership auto-transferred to the remaining participant), each step
  cross-checked against actual Postgres rows rather than trusting
  screenshots — necessary because Chrome's own translate feature kept
  auto-corrupting the visible page mid-session, a known issue from M3/M4.
  Also ran an automated parity sweep across all four translation files:
  all 97 message keys present in every locale, no missing/extra keys, no
  accidental untranslated leftovers. Full suite green (tsc, eslint, 53
  unit, 5 e2e). Updated `README.md` with a multi-language summary.
  **G-002's page-by-page translation work (M1-M5) is now complete** —
  every page, in all four languages, verified working end to end. Pushed
  and redeployed to https://meet.app.julienika.cz; confirmed live and
  confirmed the other sites on the shared host unaffected. Leaving the
  goal status as ACTIVE (not DONE) pending explicit Owner sign-off, per
  OPERATIONS.md's definition of done — same pattern G-001 followed.
- 2026-08-17 — **M4 done** (Owner said "go ahead" after M3 review).
  Translated the results page in EN/RU/CZ/DE: `results/page.tsx`'s header
  (title, participant count, participant list, edit link) and
  `results-board.tsx` (heatmap legend, grid cell tooltips, Best Times list,
  missing-names line). The participant count uses next-intl's ICU `plural`
  syntax instead of the old `count === 1 ? "person" : "people"` ternary,
  since that English-only rule doesn't generalize — Russian needs
  one/few/many/other, Czech needs one/few/other. Verified correct via raw
  SSR against a seeded 3-participant fixture: Russian correctly shows "3
  участника" (few category) and Czech "3 osoby" (few category), not a
  naive "other" fallback. `selectFinalSlot`'s error strings became i18n
  keys too, same pattern as M2/M3; `deselectFinalSlot`'s and
  `saveAvailability`'s stayed English since neither is ever actually shown
  to a user. This closes out the page-by-page translation work (M1-M4); M5
  is a QA/deploy pass across all four languages before sign-off. 53 unit +
  5 e2e tests green, tsc/eslint clean. Pushed and redeployed; confirmed
  live via raw SSR fetch and confirmed other sites on the shared host
  unaffected. **Stopping here per OPERATIONS.md milestone checkpoint —
  awaiting Owner review before starting M5** (final QA pass).
- 2026-08-17 — **M3 done** (Owner said "go ahead" after M2 review).
  Translated every string on the room/grid pages in EN/RU/CZ/DE:
  `join-form.tsx` (including the name-collision flow — used next-intl's
  `t.rich` to keep a bolded name embedded in a translated sentence with
  natural word order per language, rather than splitting the sentence
  around a hardcoded position), `app/r/[slug]/page.tsx`'s header,
  `availability-grid.tsx`'s brush toolbar and save-state text,
  `finalized-banner.tsx`, `leave-room-button.tsx`, and the shared
  `new-event-button.tsx`. `joinRoom`'s error strings (in
  `app/r/[slug]/actions.ts`) became i18n keys too, same pattern as M2's
  `createRoom` — moved out of the M4 plan into M3 since they render on
  this page, not the results page. Deliberately left untranslated: day/
  month labels and hour digits (pinned formatting, not copy — translating
  them would risk reintroducing the server/client hydration mismatch
  fixed by pinning to en-GB) and the IANA timezone picker's city names.
  Verified live across languages, working around a real annoyance: Chrome's
  own built-in page-translate feature kept auto-triggering mid-session and
  overwriting screenshots with its own machine translation (recognizable by
  reformatted 12-hour times and paraphrased text) — confirmed genuine
  correctness instead via raw `curl` SSR fetches and by screenshotting
  immediately after a hard navigation, before Chrome's translate has a
  chance to run. 53 unit + 5 e2e tests green, tsc/eslint clean. Pushed and
  redeployed; confirmed live and confirmed other sites on the shared host
  unaffected. **Stopping here per OPERATIONS.md milestone checkpoint —
  awaiting Owner review before starting M4** (results page).
- 2026-08-17 — **M2 done** (Owner said "go ahead" after M1 review). Fully
  translated the landing/create-room page in EN/RU/CZ/DE:
  `messages/{en,ru,cs,de}.json`'s new `Landing`/`CreateRoom`/`Metadata`
  namespaces, `app/page.tsx` (hero alt text, tagline — as a Server
  Component, via `getTranslations`, matching the async pattern
  `locale-switcher.tsx` already used), `create-room-form.tsx` (Client
  Component, `useTranslations`), and `app/layout.tsx`'s metadata (now
  `generateMetadata()`, locale-aware browser tab title/description).
  `lib/validation.ts`'s Zod messages became i18n keys instead of English
  sentences (confirmed via re-reading listing-studio's actual source that
  this — not a translator-aware schema factory as first planned in the
  milestone note — is the real established pattern: schema messages are
  keys, translated client-side via `t(`errors.${key}`)`); also added
  explicit key-based messages to the `dayStartHour`/`dayEndHour` bounds,
  which previously had none (would have leaked a raw Zod string). Removed
  the baked-in English `label` field from `lib/room-presets.ts`'s
  `DAILY_PRESETS` — preset names are now translated words, hour ranges
  stay locale-invariant digits via the existing `formatHoursWindow`
  formatter (no separate translated literal per language, keeping format
  and translation genuinely separate as asked). Verified live in a real
  browser across all four languages: every label/placeholder/button,
  triggered a real validation error and confirmed the translated message
  (generic banner + field-level), and completed a full room-creation
  round-trip while the UI was in German. Also caught (and ruled out as
  real) a scary-looking transient bug: after several rapid locale switches
  in one long-lived dev-mode browser tab, the language switcher's own
  option labels briefly corrupted to English-ish names — traced to stale
  Next.js client-router-cache in that one tab (a fresh `curl` to the same
  server, and a real page reload, both rendered correctly), not a bug in
  the translation code. 53 unit + 5 e2e tests green, tsc/eslint clean.
  **Stopping here per OPERATIONS.md milestone checkpoint — awaiting Owner
  review before starting M3** (room/grid page).
- 2026-08-17 — **M1 done.** Installed `next-intl@^4.13.1` (matching
  listing-studio's pin), wired `next.config.ts`/`i18n/request.ts`/
  `app/layout.tsx` for cookie-based locale resolution with English-fallback
  deep-merge, added a language switcher (`app/locale-switcher.tsx` +
  `app/locale-select.tsx`, server/client split, the client half using
  listing-studio's `key={current}` remount fix for a `<select>`-staleness
  bug) visible on every page via the root layout — added once globally
  rather than per-page. Added `latin-ext`/`cyrillic` font subsets to Geist
  (was `latin`-only, which would have silently dropped Russian text to a
  system font). `lib/ui-locales.ts` deviates from listing-studio's
  env-driven locale list: hardcoded to the fixed EN/RU/CZ/DE set the Owner
  asked for, since there's no staged-rollout need here (see HANDOVER D8).
  Verified live in a browser: switcher shows all four native language names
  correctly, switching actually round-trips through the server action and
  cookie, persists across a real (non-client-side) navigation. New unit
  test file `tests/unit/ui-locales.spec.ts`. 53 unit + 5 e2e tests green
  (e2e unaffected — runs against the default English locale with no cookie
  set), tsc/eslint clean. **Stopping here per OPERATIONS.md milestone
  checkpoint — awaiting Owner review before starting M2** (translate the
  landing/create-room page).
- 2026-08-17 — Goal created and planned with the Owner. Surveyed
  `listing-studio` first (per STANDARDS.md "minimize spread") rather than
  picking an i18n approach cold: it already uses `next-intl` with a
  cookie-based locale (no URL segment), English-fallback deep-merge for
  partial translations, and a `key`-remount fix for a known `<select>`
  staleness bug — this project will copy that pattern rather than invent
  a new one. Recommended against reCAPTCHA-adjacent or URL-prefix
  approaches to the Owner earlier in the conversation for unrelated
  reasons (frictionless-by-design); the same "don't add friction to a
  no-account app" reasoning is why locale stays cookie-based here too, not
  a login preference. Not started yet — M1 is next.
