# D006 · Room expiry is a coarse UTC-calendar-day policy, enforced lazily plus a sweep
Date: 2026-08-17 · Goal: G-001 · Status: active
Context: Owner: delete 3 days after the finalized date, or after the range end.
Decision: `lib/expiry.ts` adds 3 UTC days; `lib/room-access.ts::findActiveRoom` deletes on access; `scripts/cleanup-expired-rooms.ts` (also a compose cleanup service) catches rooms nobody revisits.
Rejected: timezone-aware expiry (unwarranted precision for a cleanup grace period).
Consequence: Every room load goes through findActiveRoom.
Evidence: `lib/expiry.ts`; `docker-compose.yml`.
