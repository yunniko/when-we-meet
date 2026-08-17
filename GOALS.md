# Goals — when-we-meet

Owner writes goals here; The Company plans, executes, and logs against them.
Statuses: `DRAFT` (not ready to start) · `ACTIVE` · `BLOCKED` · `DONE`.
Template for a new goal, company-wide numbering, and cross-project conventions
live in `E:\CLAUDE\COMPANY\GOALS.md`.

---

## Active goals

### G-001 · when-we-meet — ACTIVE
- **What:** A web service where one person ("organizer") creates a planning
  room by choosing a date range to plan over (optionally a strict daily time
  window, e.g. for an event with fixed opening hours) and gets a unique,
  unguessable URL for the room. Anyone with the URL can join under a display
  name (no account/login) and mark, in 1-hour slots, which times they CAN or
  CANNOT do across the room's range, plus an optional separate layer marking
  which of their available times they'd *prefer*. The app computes and shows
  the times when everyone overlaps, with preferred-time overlaps surfaced at
  the top. Identity within a room is a browser cookie; if a visitor without a
  cookie types a name that's already used in that room, they're shown that
  name's existing marks and asked "is this you?" before taking it over — no
  passwords, the group is trusted not to mess with each other's entries.
- **Why:** Give small friend groups a fast, frictionless way to find a time
  that works for everyone, without anyone needing to create an account.
- **Acceptance criteria:**
  1. Anyone can create a room: start date, end date, optional daily time
     window (e.g. 09:00–17:00) applied every day in range, single fixed
     timezone for the whole room (set at creation). Creating a room returns a
     unique shareable URL immediately, no login required.
  2. Opening the room URL lets a visitor enter a display name and mark
     availability on an interactive grid of 1-hour slots spanning the room's
     date range and daily time window, using CAN / CANNOT (default: unmarked
     = unknown, not "cannot"). Works with drag-to-paint on desktop and touch
     on mobile.
  3. A separate, optional "preferred" layer lets a participant mark which of
     their own CAN slots they'd prefer — can't prefer a slot not marked CAN.
  4. A results view shows, across the whole room, which slots the most
     people are free for; slots where *everyone* is free are highlighted;
     among equally-available slots, ones with more "preferred" marks sort to
     the top.
  5. Revisiting the room URL in the same browser (cookie present) shows the
     participant their own name and prior marks, editable at any time — no
     re-entry of name needed.
  6. Revisiting without a cookie (new browser/device) and entering a name
     that already exists in that room shows that name's current marks and
     asks "is this you?" — confirming takes over editing that identity
     (sets a fresh cookie); declining lets them pick a different name.
  7. No account system, no password, no per-user auth beyond the
     name+cookie convention above — this is an explicit, documented trust
     model, not an oversight.
  8. Usable on a phone screen, not just desktop.
- **Constraints:** no deadline; budget = none (no paid services); stack is
  JulAI's choice, reviewed by Owner at first check-in. No accounts, no
  external services, no payments — this project needs none of those.

**Scope decisions** (clarified with Owner 2026-08-17):
  - Time granularity: 1-hour slots (not 30-min, not whole-day-only).
  - Timezone: single implicit timezone per room, set once at creation; all
    participants mark and view in that same wall-clock time. Per-participant
    timezone conversion is explicitly out of scope (documented trust/simplicity
    trade-off, matches "friends coordinating one meetup" framing).
  - Project name: when-we-meet.

**Milestones** (filled in by The Company during planning):
- [ ] M1 — Foundation: Next.js/TS/Prisma/Postgres scaffold running locally
      (Docker for Postgres, `npm run dev` for the app), data model (Room,
      Participant, Availability), room creation flow (date range + optional
      daily time window + timezone), unique unguessable room URL. README and
      HANDOVER stubs in place.
- [ ] M2 — Join & mark availability: name entry with cookie-based identity,
      name-collision "is this you?" prompt (shows existing marks), interactive
      1-hour-slot grid with drag-to-paint CAN/CANNOT, mobile touch support,
      save/load a participant's own marks.
  - [ ] M3 — Preferred layer + results: optional "preferred" marking layer
      constrained to a participant's own CAN slots; overlap computation across
      all participants; results view ranking slots by availability count with
      full-group and preferred-overlap slots surfaced at the top.
- [ ] M4 — Edge cases & polish: strict single-day/fixed-hours event mode,
      always-editable own marks, empty/error states (room not found, name
      taken by a *different* confirmed identity mid-session), responsive/mobile
      pass, basic abuse-resistance (token unguessability, no enumeration).
- [ ] M5 — Testing & sign-off: unit tests for the overlap/ranking algorithm,
      Playwright e2e for create → join → mark → view-results and the
      name-collision flow, manual verification of the running app, README/
      HANDOVER finalized.

**Progress log** (newest first; The Company appends at every stopping point):
- 2026-08-17 — Goal created and planned with the Owner (granularity, timezone,
  and project-name decisions made via clarifying questions). Stack decision
  pending — will follow portfolio precedent (TypeScript/Next.js/PostgreSQL/
  Prisma, per listing-studio D1) minus the pieces this project doesn't need
  (no Auth.js, no Redis/BullMQ, no Stripe — no accounts/payments/queues here).
  Starting M1.
