# D013 · Only a listed-only leave is marked as "left" for the owner
Date: 2026-09-15 · Goal: G-004 M3 · Status: active (superseded by: —)
Context: the Owner asked that the room owner can see when a person has left. Under "listed names only" leaving keeps the name as unclaimed, which looked the same as a name nobody ever claimed.
Decision: a reset sets `leftAt` on the participant and claiming the name clears it; the owner panel tags such names "left the room" instead of "not joined yet".
Rejected: keeping a record of people who leave a room anyone can join (leaving there promises to delete the name); showing the tag to everyone (the request was for the owner).
Consequence: any new way of resetting a name must set `leftAt`, and any claim must clear it.
Evidence: tests/integration/membership.spec.ts (listed-only leave marked as left); tests/e2e/owner-roster.spec.ts
