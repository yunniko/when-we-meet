# Handover — When We Meet
Last verified: 2026-11-23 at f6f3f5b (deployed)

Account-free group scheduling: a room with a date range, participants paint CAN/CANNOT/prefer
in 1-hour slots, results rank the overlaps, the creator can finalize a time. Goals: `GOALS.md`
G-001 and G-002 (both fully built, both ACTIVE pending Owner sign-off); G-003 (owner removes a
participant) is DONE (signed off 2026-09-13, see `docs/goals-archive.md`); G-004 (invited-names list) is built and deployed, ACTIVE pending Owner sign-off. The project
is the pilot of the Company ui-kit (G-001 in `E:\CLAUDE\projects\ui-kit\GOALS.md`), on branch
`goal/ui-kit-g001` in the worktree `E:\CLAUDE\worktrees\when-we-meet--ui-kit-g001`. Conventions: `AGENTS.md`. Charter: `E:\CLAUDE\COMPANY\`.

## Current state

- **Live** at https://meet.app.julienika.cz (HTTP 200 re-checked 2026-11-22). App port 30010,
  Postgres 54321 (127.0.0.1). Live build is f6f3f5b (deployed 2026-11-23), which includes the ui-kit
  pilot below.
- Done and deployed: G-001 M1–M5 (rooms, cookie identity with "is this you?", drag-painted grid,
  prefer layer, results heatmap + Best times, creator finalize/clear, 3-day expiry), the
  post-launch rounds (weekend shading, sticky headers, leave-room with ownership transfer,
  daily-window presets, missing-names list, CANNOT-aware ranking, join-page clarity, 100-
  participant cap), G-002 (EN/RU/CS/DE UI), a security review (frame headers, slot-count cap),
  a token-gated `/status` page, mobile layout fixes, `/about` (Terms/Privacy), SEO baseline
  (robots, sitemap, OG, a dormant `GOOGLE_SITE_VERIFICATION` seam), timezone auto-detect with
  fallbacks and a collapsed picker, optional room description, touch hold-to-paint with native
  swipe scrolling and no saves for strokes that change nothing (D009).
- G-003 (2026-09-13): the owner sees a Participants panel under the grid and removes others after
  typing their name; the server re-checks everything under the room lock (D010). Saves refuse a
  stale or switched identity and the grid reloads.
- G-004 (2026-09-13 to 15): a room can be created with invited names and a join rule: anyone with
  the link, or listed names only, where the creating browser can still join under any name. Invited
  names are tappable on the join page; the room page, owner panel and results separate joined
  people from invited ones (D011). The owner adds names, removes unclaimed ones in one click and
  switches the rule from the panel; a listed-only leave keeps the name and tags it "left the room"
  for the owner (D013).
- Post-launch (2026-09-28): the availability grid gained bulk-fill shortcuts — double-click/tap a
  day's header, an hour's label, or the top-left corner fills that day, hour, or the whole grid
  with the current brush. The corner (whole-grid) fill has no confirmation prompt; instead the
  grid has Undo/Redo buttons backed by a stroke-level history, persisted per room+participant in
  `localStorage`, capped at 20 entries each way (D014).
- ui-kit pilot (2026-11-22, branch only): every screen uses design tokens and the kit's
  components, so each hint, error, status, confirmation and empty state has one form and a
  reserved place; UI copy is 12% shorter (`docs/reviews/2026-11-22-ui-message-inventory.md`);
  the accent was darkened for contrast (D016); Prettier added (D017). The ui-kit page is
  at `/dev/ui-kit` under `npm run dev` only (D018). Each message slot is sized for the longest
  message it can show, listed in `lib/message-slots.ts`, and every such message fits one line at
  360px in all four locales with 6% of the line to spare (D021, ui-kit D009).
- ui-kit page (2026-11-23, deployed in f6f3f5b): built from the real components. Every component file
  has a sibling `.states.tsx` that imports it and only passes it sample data (`app/dev/ui-kit/samples.ts`);
  `app/dev/ui-kit/registry.ts` is generated from them, and the Messages section renders every key in
  `lib/message-slots.ts`. Route files only load data and compose components (`PageColumn`, `Panel`, `TextLink`
  in `components/layout/`; `SiteShell`, `Landing`, `RoomHeader`, `IdentityPanel`, `RoomRoster`, `StatusView`…),
  and every button and link takes its look from the kit (`Button` sizes `md`/`sm`, `buttonClass`, the link
  classes), so `ui-check` fails on markup the page cannot show (ui-kit D010, D011). Visible effects: link hover is
  a thicker underline; small buttons, the new-event link and the language select now have 44px targets.
- Verification on 2026-11-23 (this branch, components move): unit 122/122; `ui-check`, `tsc`, `format:check`
  clean; `build:check` clean; e2e 35/35 against a production build (`next start`) plus the ui-kit page spec
  under `next dev` — a stray dev server held the directory, so the standard config could not start its own.
- Verification on 2026-11-22 (2046ba4): GitHub CI green (run 45060186882); locally unit 122/122,
  e2e 36/36 with no retries (1 worker), `ui-check` clean (4 static sections), `format:check` and `tsc` clean,
  lint 1 old warning (`_formData` in `app/r/[slug]/actions.ts`), `build:check` reports no ui-kit
  page in `.next`.
- CI: `.github/workflows/ci.yml` runs format, lint, route types (`next typegen`), types, the ui-kit
  static checks, unit, integration, `build:check` and e2e on every push to `master`.

## How things fit together

- `lib/`: pure modules, one unit spec each — `slots.ts` (dates/hours/labels), `results.ts`
  (overlap ranking: can desc, cannot asc, preferred desc, chronological), `validation.ts`,
  `expiry.ts`, `time.ts` (the only real tz conversion), `room-presets.ts`, `timezone-guess.ts`;
  server-only `cookies.ts`, `participant.ts`, `owner.ts`, `room-access.ts`, `legal.ts`.
- `app/actions.ts` (createRoom) and `app/r/[slug]/actions.ts` (joinRoom, leave, saveAvailability,
  removeParticipant, select/deselectFinalSlot) re-derive identity from the cookie every call.
  Every membership write (join, claim, leave, removals, ownership) is in `lib/membership.ts`
  under the room lock; its rules are pure functions in `lib/roster.ts` (D010, D011).
- `app/r/[slug]/`: join form, availability grid (pointer events; brush rules and stroke
  interpolation in `lib/paint.ts`; touch gestures per D009),
  owner participants panel, results board, finalized banner. `app/status/page.tsx` needs `?key=STATUS_PAGE_TOKEN`.
- i18n: `i18n/request.ts`, `lib/ui-locales.ts`, `messages/{en,ru,cs,de}.json` (177 keys; keys
  and ICU arguments checked by `tests/unit/messages-parity.spec.ts`).
- UI: `design/tokens.json` generates `app/tokens.css` (`node scripts/ui-kit/ui-tokens.mjs`);
  `design/ui-kit.json` configures the checks. `components/ui-kit/`, `scripts/ui-kit/` and
  `tests/e2e/ui-kit/` are copies synced from `E:\CLAUDE\projects\ui-kit` (run its bin/sync.mjs
  with this directory); a new component needs its `.states.tsx`, then `node scripts/ui-kit/ui-check.mjs . --write`; `tests/e2e/ui-quality.spec.ts` holds this project's UI checks. Legal text: `docs/legal/about-terms-privacy.md` via `marked`, copied into the image.
- Tests: Vitest in `tests/unit/` (no database) and in `tests/integration/` against the dev Postgres
  (`vitest.integration.config.ts`); Playwright in `tests/e2e/` on port 30099 (own dev server),
  asserting through the UI (Prisma's ESM client can't load under Playwright's transform).

## Rules in force

- Slots are wall-clock pairs; never route them through Date/timezone math (D002).
- Load rooms only via `findActiveRoom` (D006). Creator rights follow the participant (D007).
- Any element whose `defaultValue` or client state must refresh on a server-driven change needs
  a `key` (the locale select; the availability grid keyed by participant id) — same bug class as
  listing-studio D057.
- Any write that changes a room's members or owner goes through `lib/membership.ts`, under the
  room row lock (D010). Anything that counts or lists people picks joined or invited (D011).
- Anything done on a participant's behalf passes an actor (id plus cookie token), re-checked inside
  the write; never a bare participant id (D012).
- The join rule is enforced only inside `joinByName`, under the room lock; the browser holding the
  room's owner-token cookie may add any name.
- Any code that resets a name must set its left time, and any claim must clear it (D013).
- `HistoryEntry.before`/`after` (grid undo/redo, `lib/paint.ts`) use `null` for "empty", never
  `undefined` — `JSON.stringify` silently drops an `undefined`-valued property, corrupting the
  persisted history across a reload (D014).
- Show every hint, error, status, confirmation and empty state through a kit component, never a
  hand-made element; never edit the kit copies here (D015; `ui:check` enforces the first).
- Deploy from a tree where `npm run build:check` passes, not a bare `next build` (D018).
- Forms that must keep state after a failed action call the `useActionState` action manually
  from `onSubmit`, not through the native `action` prop (React 19 resets the form otherwise).
- Env vars reach the container only if listed in `docker-compose.yml`'s `app` service
  (`STATUS_PAGE_TOKEN`, `GOOGLE_SITE_VERIFICATION`); `robots`/`sitemap` routes are `force-dynamic`
  so `APP_URL` isn't baked at build time.
- Redeploy: on the host, `git pull && docker compose --profile app up -d --build` in
  `/var/www/repositories/when-we-meet`; then confirm the other sites still respond.

## Next steps and open questions

- The daily-window slot keeps one empty line under the presets when no custom hours are open: it reserves
  `dayEndBeforeStart`, which only custom hours can show. Fix, then redeploy.
- The availability grid cannot be marked from the keyboard (WCAG 2.1.1): a feature for the Owner to
  schedule, not a copy change.
- `playwright.config.ts` has `retries: 1`, which hides flakes; `create-join-mark-results` fails
  rarely at its `toHaveURL` without retries, cause unknown (evidence: ui-kit G-001 progress log).
  With the CPU saturated by another process, many specs time out at 30s; run e2e on an idle machine.

- Owner: sign off G-004 after trying it on the live site. Then delete the pre-G-004 database
  backup in the host's backups folder (it holds participant names).
- Try drag-paint, tap and swipe on a real phone against the live site (Chromium emulation only
  so far).
- Owner: sign off G-001 and G-002; register the site in Google Search Console and set
  `GOOGLE_SITE_VERIFICATION`; confirm the `info@julienika.cz` inbox is monitored.
- Touch gestures are verified only under Chromium emulation, not on a real phone (iOS Safari
  in particular); no automated coverage for
  creator-leaves-ownership-transfer, the 100-participant cap, or a past-dated room's future-only
  check.
- Product questions: block past dates at creation? Should the heatmap distinguish CANNOT from
  unmarked? Should day/month names follow the UI language?
- Future direction (not now): participant profiles with a default weekly template.

## Deploy log

| Date | Commit | What changed | Verified how |
|---|---|---|---|
| 2026-08-17 | — | First deploy (port 30010) plus the same-day UX, i18n and font-fix rounds | Full flow in a real browser on the live URL; other sites 200 |
| 2026-08-18 → 2026-08-20 | — | Security headers + slot cap, status page, mobile layout fixes, room description | curl header checks; Pixel-5 Playwright screenshots; suite green |
| 2026-08-23 | ee4fb2d | Timezone auto-detect + collapsed picker, SEO baseline, `/about` page | Local robots/sitemap/OG check; live HTTPS check |
| 2026-09-12 | 4f0a539 | Touch hold-to-paint + native swipe scrolling (D009); no saves for no-op strokes | Local unit 75/75 + e2e 6/6 incl. Pixel-5 touch spec; host on 4f0a539, containers rebuilt; live 200; 7 other sites 200, no other container restarted |
| 2026-09-13 | fc6d569 | G-003: owner Participants panel with type-to-confirm removal; stale-identity save handling | Local unit 82/82 + e2e 11/11 no retries; host on fc6d569, migrate exit 0, app log clean; live 200 serving the new strings; 7 other sites 200; uptime diff shows only when-we-meet app + cleanup restarted |
| 2026-09-15 | 741913d | G-004: invited names, join rule, owner list editing, left marker; migrations for join rule (with backfill) and left time | Local unit 107/107, integration 29/29, e2e 19/19; DB backup first (gzip ok, 4 tables); migrate exit 0, both migrations finished, 10/10 participants joined after backfill; live 200 serving new strings; 7 other sites 200; only when-we-meet app and cleanup restarted |
| 2026-09-28 | e304af2 | Double-click/double-tap a day header fills that day with the current brush | Local unit 107/107, e2e incl. new fill-day spec under parallel load; no migration; migrate exit 0; live 200, feature exercised live; only when-we-meet app+cleanup restarted |
| 2026-09-28 | f9dd100 | Adds hour-label and corner (whole-grid) fill shortcuts | Local unit 107/107, e2e incl. new fill-hour/all specs; no migration; migrate exit 0; live 200; only when-we-meet app+cleanup restarted |
| 2026-09-28 | ee8e689 | Owner feedback: replaces the corner-fill confirmation with Undo/Redo (D014); fixes an `undefined`-in-JSON history bug the new persistence surfaced | Local unit 113/113, e2e 25/25 incl. under parallel-worker load; no migration; migrate exit 0; live 200, undo/redo exercised live incl. persistence across a reload; only when-we-meet app+cleanup restarted |
| 2026-11-22 | 6272b32 | ui-kit pilot: tokens, kit components, message slots sized for their messages, shorter copy (D015–D021) | Local unit 122/122, integration 29/29, e2e 36/36; live create form at 360px in en/ru/cs/de: error moves nothing, axe 0 serious, no console error; 16 sites 200, no other container restarted |
| 2026-11-22 | 2046ba4 | CI route types; 27 messages shortened to fit one line with headroom on Linux (ui-kit D009) | GitHub CI green incl. e2e; no migration; live check repeated, same results; 16 sites 200, only app+cleanup restarted |
| 2026-11-23 | f6f3f5b | Route files compose components; buttons, links and controls take kit looks (ui-kit D011, D012) | GitHub CI green incl. e2e (run 45215710765); no migration, migrate exit 0; live landing: no control under 44px, no console error; 16 sites 200, only app+cleanup restarted |

## Decisions

`docs/decisions/README.md` (D001–D014).
