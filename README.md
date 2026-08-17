# When We Meet

A no-account scheduling tool for groups of friends. One person creates a
planning room (a date range, optionally a daily time window, and a
timezone) and gets a shareable link. Everyone with the link marks which
1-hour slots they can/can't do — plus optionally which of those they'd
prefer — and the app shows when the whole group overlaps.

Full context, architecture, and decision history: see `HANDOVER.md`.
Goal and milestone tracking: see `GOALS.md`.

## Current state

M1 (foundation) in progress: room creation is implemented and verified —
creating a room writes it to Postgres and redirects to its unique
`/r/<slug>` URL. Joining a room and marking availability lands in M2.

## Running it locally

```bash
cp .env.example .env          # defaults already match docker-compose.yml
docker compose up -d db       # starts Postgres on 127.0.0.1:54321
npx prisma migrate deploy     # applies migrations (already applied after `migrate dev`)
npm install
npm run dev                   # http://localhost:3000
```

Tests (once added, see GOALS.md M5): `npm test` (Vitest unit + Playwright e2e).

## Deploying

`docker compose --profile app up -d --build` builds and runs the app
container against the `db` service (see `Dockerfile`, `docker-compose.yml`).
Actual deployment (a real host, a real domain) is a separate,
Owner-approved step — nothing here does that on its own.
