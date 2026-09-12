# D001 · Stack: TypeScript / Next.js / PostgreSQL / Prisma, no auth, queue or payment layers
Date: 2026-08-17 · Goal: G-001 · Status: active
Context: Matches the portfolio default set in listing-studio; this app has no accounts, payments or background jobs by design.
Decision: Same stack minus Auth.js, Redis/BullMQ and Stripe.
Rejected: a lighter framework (no material advantage).
Consequence: Adding those layers is a scope change, not a consistency fix.
Evidence: `package.json`.
