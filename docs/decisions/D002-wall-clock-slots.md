# D002 · Availability slots are plain wall-clock (date, hour) pairs, never converted through timezone math
Date: 2026-08-17 · Goal: G-001 · Status: active
Context: One implicit timezone per room; `Room.timezone` is a label. UTC instants would need DST-correct conversion for zero benefit.
Decision: `slotDate` + `slotHour` (0–23); the results algorithm is pure integer/date comparison. `formatDayLabel` is pinned to en-GB after a real server/client hydration mismatch.
Rejected: real DateTime instants via a tz library.
Consequence: The only tz conversion is `lib/time.ts` (a one-way "now" read for the future-only rule).
Evidence: `prisma/schema.prisma`; `lib/slots.ts`.
