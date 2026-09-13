# D012 · A request acts as a participant only while its cookie token still matches
Date: 2026-09-13 · Goal: G-004 M1 · Status: active (superseded by: —)
Context: resetting a name under "listed names only" keeps the participant id and rotates the cookie token, so a request that resolved its cookie just before a reset could still act under that id, even after someone reclaimed the name.
Decision: every write made on a participant's behalf (leave, both removals, saving marks, setting or clearing the meeting time) re-checks id and cookie token inside the write; saving marks holds the participant row `FOR SHARE` so it runs strictly before or after a reset.
Rejected: deleting and recreating the invited row on reset (breaks ownership succession and "click your name" continuity); taking the room lock on every save (every paint stroke would queue behind membership changes).
Consequence: actions pass an actor (participant id plus cookie token) into `lib/membership.ts`, never a bare id. A reset rotates the token before it deletes marks.
Evidence: tests/integration/membership.spec.ts (stale requests after a reset; saveMarks)
