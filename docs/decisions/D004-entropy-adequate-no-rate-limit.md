# D004 · Slug/cookie entropy is adequate; no rate limiting; join-race fix verified at the Prisma level
Date: 2026-08-17 · Goal: G-001 · Status: active
Context: 12-char slugs from a 32-symbol alphabet (~60 bits), no enumeration endpoint; cookie tokens ~190 bits, httpOnly. Trust model = friend groups.
Decision: No rate limiting (no Redis, not called for). The joinRoom TOCTOU race is handled by catching Prisma P2002 and recovering via the ordinary collision flow; verified by two concurrent creates against the dev DB. Later caps: 100 participants per room, 1,500 slots per save.
Rejected: reCAPTCHA (Google account, friction).
Consequence: Revisit if genuinely adversarial traffic appears.
Evidence: `lib/slug.ts`; `app/r/[slug]/actions.ts`.
