# Handover — When We Meet
Last verified: 2026-09-12 at 4f0a539

Account-free group scheduling: a room with a date range, participants paint CAN/CANNOT/prefer
in 1-hour slots, results rank the overlaps, the creator can finalize a time. Goals: `GOALS.md`
G-001 and G-002 (both fully built, both ACTIVE pending Owner sign-off). Conventions:
`AGENTS.md`. Charter: `E:\CLAUDE\COMPANY\`.

## Current state

- **Live** at https://meet.app.julienika.cz (HTTP 200 re-checked 2026-09-12). App port 30010,
  Postgres 54321 (127.0.0.1). Live build is 4f0a539 (deployed 2026-09-12).
- Done and deployed: G-001 M1–M5 (rooms, cookie identity with "is this you?", drag-painted grid,
  prefer layer, results heatmap + Best times, creator finalize/clear, 3-day expiry), the
  post-launch rounds (weekend shading, sticky headers, leave-room with ownership transfer,
  daily-window presets, missing-names list, CANNOT-aware ranking, join-page clarity, 100-
  participant cap), G-002 (EN/RU/CS/DE UI), a security review (frame headers, slot-count cap),
  a token-gated `/status` page, mobile layout fixes, `/about` (Terms/Privacy), SEO baseline
  (robots, sitemap, OG, a dormant `GOOGLE_SITE_VERIFICATION` seam), timezone auto-detect with
  fallbacks and a collapsed picker, optional room description, touch hold-to-paint with native
  swipe scrolling and no saves for strokes that change nothing (D009).
- Verification on 2026-09-12: `npm run test:unit` 75/75; `npm run test:e2e` 6/6 against the
  local dev Postgres (Docker), including a Pixel-5 touch spec.
- Working tree: an uncommitted doc-reference edit to the previous handover (2026-09-06); the
  old handover is kept as `docs/handover-legacy-2026-09-12.md` until reviewed, then delete it.

## How things fit together

- `lib/`: pure modules, one unit spec each — `slots.ts` (dates/hours/labels), `results.ts`
  (overlap ranking: can desc, cannot asc, preferred desc, chronological), `validation.ts`,
  `expiry.ts`, `time.ts` (the only real tz conversion), `room-presets.ts`, `timezone-guess.ts`;
  server-only `cookies.ts`, `participant.ts`, `owner.ts`, `room-access.ts`, `legal.ts`.
- `app/actions.ts` (createRoom) and `app/r/[slug]/actions.ts` (joinRoom, leave, saveAvailability,
  select/deselectFinalSlot) re-derive identity from the cookie every call.
- `app/r/[slug]/`: join form, availability grid (pointer events; brush rules and stroke
  interpolation in `lib/paint.ts`; touch gestures per D009),
  results board, finalized banner. `app/status/page.tsx` needs `?key=STATUS_PAGE_TOKEN`.
- i18n: `i18n/request.ts`, `lib/ui-locales.ts`, `messages/{en,ru,cs,de}.json` (97 keys, parity
  checked). Legal text: `docs/legal/about-terms-privacy.md` via `marked`, copied into the image.
- Tests: Vitest in `tests/unit/`; Playwright in `tests/e2e/` on port 30099 (own dev server),
  asserting through the UI (Prisma's ESM client can't load under Playwright's transform).

## Rules in force

- Slots are wall-clock pairs; never route them through Date/timezone math (D002).
- Load rooms only via `findActiveRoom` (D006). Creator rights follow the participant (D007).
- Any element whose `defaultValue` must refresh on a server-driven change needs a `key` (the
  locale select) — same bug class as listing-studio D057.
- Forms that must keep state after a failed action call the `useActionState` action manually
  from `onSubmit`, not through the native `action` prop (React 19 resets the form otherwise).
- Env vars reach the container only if listed in `docker-compose.yml`'s `app` service
  (`STATUS_PAGE_TOKEN`, `GOOGLE_SITE_VERIFICATION`); `robots`/`sitemap` routes are `force-dynamic`
  so `APP_URL` isn't baked at build time.
- Redeploy: on the host, `git pull && docker compose --profile app up -d --build` in
  `/var/www/repositories/when-we-meet`; then confirm the other sites still respond.

## Next steps and open questions

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

## Decisions

`docs/decisions/README.md` (D001–D009).
