# D011 · Invited names are participant rows with an empty join time
Date: 2026-09-13 · Goal: G-004 M1 · Status: active (superseded by: —)
Context: G-004 lets the owner pre-add expected names and restrict joining to them; claiming a pre-added name must reuse the "is this you?" flow, name uniqueness and the participant cap.
Decision: an invited name is a participant row with `joinedAt` null; the room stores its join rule and an `ownershipVacant` flag, set when an owner leaves with nobody joined to inherit, so the next joiner or claimer becomes owner.
Rejected: a separate seat table (pays off only if a seat must outlive the person's identity, and removal drops the seat); treating every ownerless room as vacant (a stranger opening the link before the creator joins would take the room).
Consequence: anything that counts or lists people must pick joined or invited explicitly; results and succession use joined only. Existing participants were backfilled with `joinedAt = createdAt`. All membership writes go through `lib/membership.ts` under the D010 lock.
Evidence: tests/integration/membership.spec.ts; tests/unit/roster.spec.ts; prisma/migrations/20260913120000_join_rule_invited_participants/migration.sql
