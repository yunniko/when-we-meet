# D010 · Membership and ownership writes serialize on a room row lock
Date: 2026-09-13 · Goal: G-003 M1 · Status: active (superseded by: —)
Context: owner removal of a participant and a creator leaving (with ownership succession) can run concurrently; with plain read-then-write, a removal could delete the participant who was just made owner, or succession could pick a row being deleted.
Decision: every write that changes who is in a room or who owns it runs in an interactive transaction that first takes `SELECT … FOR UPDATE` on the room row, then re-reads ownership before acting.
Rejected: serializable isolation for these actions (retry handling on every call, for a rare race); optimistic `updateMany` predicates only (cannot cover the two-step read-then-succeed in leaveRoom).
Consequence: `joinRoom`'s create path and the G-004 lifecycle (claim, conditional remove, seat reset) must take the same lock; never add a membership or ownership write outside it. The lock is per room, so unrelated rooms never wait on each other.
Evidence: tests/e2e/stale-identity.spec.ts; commit 3619a36
