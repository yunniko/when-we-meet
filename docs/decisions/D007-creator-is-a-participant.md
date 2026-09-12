# D007 · Creator permission is tied to a participant identity, not a standalone cookie
Date: 2026-08-17 · Goal: G-001 · Status: active
Context: A device-bound owner cookie had no recovery path; the Owner wanted "log in under the creator's name gives creator's permissions".
Decision: `Room.creatorParticipantId`; the one-shot owner cookie only tags the creating browser's first joined participant. If the creator never joins, nobody gets creator rights. When a creator leaves, ownership auto-transfers to the longest-present participant (Owner choice).
Rejected: owner cookie only; a transfer-ownership flow (no accounts).
Consequence: The creator must join normally to be recognized.
Evidence: `lib/owner.ts`.
