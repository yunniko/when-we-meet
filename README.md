# When We Meet

A no-account scheduling tool for groups of friends. One person creates a
planning room (a date range, optionally a daily time window, and a
timezone) and gets a shareable link. Everyone with the link marks which
1-hour slots they can/can't do — plus optionally which of those they'd
prefer — and the app shows when the whole group overlaps. The room's
creator can then lock in a final meeting time, which is shown prominently
to everyone and closes further marking until they clear it. Rooms clean
themselves up a few days after their date has passed. The UI is available
in English, Russian, Czech, and German (switchable per visitor, no login
needed — see "Language").

Full context, architecture, and decision history: see `HANDOVER.md`.
Goal and milestone tracking: see `GOALS.md`.

## Current state

**G-001** (the core scheduling tool): all five planned milestones are done
and verified — creating a room (including a single-day fixed-hours event
mode), joining under a name (cookie-based identity, race-condition-safe
name-collision handling), marking availability on the 1-hour-slot grid
(drag-to-paint, mouse and touch, with an optional "prefer this slot"
layer), a results view (heatmap + ranked "best times", factoring in both
who can and who's explicitly said they can't), the creator picking/
locking/clearing a final meeting time (very visible to everyone,
future-dated only), automatic room expiry 3 days after the relevant date,
and a light warm theme with a hand-drawn hero illustration. Several
post-launch rounds since then added: daily time-window presets, a
100-participant cap (abuse-resistance backstop), and clearer copy on the
join screen.

**G-002** (multi-language UI): the entire app — every page, button, and
error message — is translated into English, Russian, Czech, and German,
switchable via the language picker in the top-right corner of every page
(a cookie-based preference, not a login setting or URL segment, so shared
room links look identical to everyone regardless of language). Dates,
hours, and timezone names are deliberately **not** localized — they stay
in a single consistent format for everyone in a room, by design (see
`HANDOVER.md` D2/D8).

53 Vitest unit tests + 5 Playwright e2e specs, all green. See `HANDOVER.md`
for the full picture, including a couple of still-open flags for the Owner
(none blocking).

## Running it locally

```bash
cp .env.example .env          # defaults already match docker-compose.yml
docker compose up -d db       # starts Postgres on 127.0.0.1:54321
npx prisma migrate deploy     # applies migrations (already applied after `migrate dev`)
npm install
npm run dev                   # http://localhost:3000
```

Tests: `npm test` (Vitest unit + Playwright e2e — e2e boots its own dev
server on a dedicated port, see `playwright.config.ts`). `npm run
test:unit` / `npm run test:e2e` to run just one layer.

Rooms past their retention window (3 days after the finalized meeting date,
or 3 days after the planning range's end if nothing was finalized) are
deleted lazily on next access, but a room nobody revisits won't clean
itself up that way — run `npm run cleanup` to sweep all expired rooms
immediately.

## Deploying

**Live at https://meet.app.julienika.cz.** Deployed on a shared VPS
alongside several other sites, following the same pattern as this
portfolio's `listing-studio`: `docker compose --profile app up -d --build`
builds and runs the app container plus a `cleanup` service (sweeps expired
rooms daily) against the `db` service, with nginx reverse-proxying and
Certbot-issued SSL in front. Full setup, server details, and how to
redeploy: see `HANDOVER.md` → "Git remote & deployment".
