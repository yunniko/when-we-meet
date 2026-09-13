# Handover — When We Meet
Last verified: 2026-09-13 at 9085ad5

Account-free group scheduling: a room with a date range, participants paint CAN/CANNOT/prefer
in 1-hour slots, results rank the overlaps, the creator can finalize a time. Goals: `GOALS.md`
G-001 and G-002 (both fully built, both ACTIVE pending Owner sign-off); G-003 (owner removes a
participant) is DONE (signed off 2026-09-13, see `docs/goals-archive.md`); G-004 (invited-names list) is ACTIVE at M2 of 3 (invited names and the join rule work; owner editing is M3). Conventions:
`AGENTS.md`. Charter: `E:\CLAUDE\COMPANY\`.

## Current state

- **Live** at https://meet.app.julienika.cz (HTTP 200 re-checked 2026-09-13). App port 30010,
  Postgres 54321 (127.0.0.1). Live build is fc6d569 (deployed 2026-09-13, includes G-003); G-004 M1–M2 (up to 9085ad5) are
  committed and pushed, not deployed. Deploying them runs the join-rule migration.
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
- G-004 M1–M2 (2026-09-13): a room can be created with invited names and a join rule: anyone with
  the link, or listed names only, where the creating browser can still join under any name. Invited
  names are tappable on the join page; the room page, owner panel and results separate joined
  people from invited ones (D011). The owner can't yet edit the list or switch the rule (M3).
- Verification on 2026-09-13: `npm run test:unit` 105/105; `npm run test:integration` 23/23;
  `npm run test:e2e` 15/15 with no retries, both against the local dev Postgres (Docker).
- Working tree: an uncommitted doc-reference edit to the previous handover (2026-09-06); the
  old handover is kept as `docs/handover-legacy-2026-09-12.md` until reviewed, then delete it.

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
- i18n: `i18n/request.ts`, `lib/ui-locales.ts`, `messages/{en,ru,cs,de}.json` (97 keys, parity
  checked). Legal text: `docs/legal/about-terms-privacy.md` via `marked`, copied into the image.
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
- Forms that must keep state after a failed action call the `useActionState` action manually
  from `onSubmit`, not through the native `action` prop (React 19 resets the form otherwise).
- Env vars reach the container only if listed in `docker-compose.yml`'s `app` service
  (`STATUS_PAGE_TOKEN`, `GOOGLE_SITE_VERIFICATION`); `robots`/`sitemap` routes are `force-dynamic`
  so `APP_URL` isn't baked at build time.
- Redeploy: on the host, `git pull && docker compose --profile app up -d --build` in
  `/var/www/repositories/when-we-meet`; then confirm the other sites still respond.

## Next steps and open questions

- G-004 M3 (owner adds names, removes unclaimed names without typing, switches the rule; a
  listed-only "leave" that explains the name stays on the list) awaits Owner approval. Deploy after
  M3: until then a person missing from a listed-only room's list has no way in.
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

## Decisions

`docs/decisions/README.md` (D001–D012).
