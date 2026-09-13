# Goals archive — when-we-meet

Goals moved out of `GOALS.md` after Owner sign-off (OPERATIONS.md §5), newest first.

### G-003 · Owner can remove a participant — DONE
- **What:** The room creator (the participant tagged as owner, D007) gets a
  "Participants" panel on the room page listing everyone in the room, each
  with a Remove control. Removing is gated behind typing that participant's
  name exactly (trimmed, case-insensitive) into a confirmation field; only
  then does the destructive button enable. Removal deletes the participant
  row and, through the existing cascade, every mark they made — the same
  effect as that person choosing "Leave the room" themselves.
- **Why:** Duplicate or mistaken joins ("Anna" and "anna k"), people who
  dropped out, or a name typed by accident stay in the room forever, distort
  the results ("everyone can" needs everyone), and only that person can
  remove them today. This is a tidy-up tool inside the existing trust model
  (anyone with the link can claim any name, including the owner's), not
  enforceable moderation.
- **Acceptance criteria:**
  1. Only the owner sees the panel and only the owner's requests succeed:
     the action re-derives identity from the cookie, resolves the room
     through `findActiveRoom`, and refuses non-owners, targets from other
     rooms, and the owner's own row (the owner uses "Leave the room" for
     that, which transfers ownership).
  2. The typed name must match the target's name (trimmed, case-
     insensitive) both in the UI (button disabled otherwise) and again on
     the server, so a crafted request can't skip it.
  3. Ownership check and deletion happen in one transaction that re-reads
     the room, so an ownership transfer racing the removal can't delete the
     new owner.
  4. After removal the person's marks are gone from results and from every
     "also in room" list. Their browser: the next save is refused with a
     distinguishable "you were removed" result, the grid reloads to the join
     form. A save also carries the participant id the grid was rendered
     for, and a mismatch (identity switched in another tab) is refused.
  5. Cancel backs out with nothing changed. Works on a phone.
  6. e2e covers: non-owner never sees the panel; mismatch keeps the button
     disabled; cancel; confirm removes name and marks; the removed browser
     lands on the join form on its next save.
- **Constraints:** No new dependencies. Same confirmation styling as the
  existing "Leave the room" flow. EN/RU/CS/DE shipped with the feature.

**Milestones** (planned 2026-09-13, awaiting Owner approval):
- [x] M1 — Pure logic + action: name-match rule in `lib/roster.ts` (unit-
  tested), `removeParticipant` with every check in AC 1–3 inside one
  transaction, `saveAvailability` returning a distinguishable removed/
  mismatch result and taking the expected participant id. Verified by unit
  tests and a Playwright spec exercising the refusals through the UI.
- [x] M2 — Owner panel on the room page (participant list + type-to-confirm
  removal), removed-session handling in the grid, i18n in four languages,
  full-flow e2e, handover + decision record, deploy after approval.

**Progress log** (newest first):
- 2026-09-13 — **Owner sign-off:** "everything looks ok" after trying the live
  feature. Status DONE; moved from `GOALS.md` to this archive.
- 2026-09-13 — **Deployed on Owner approval (host at fc6d569).** Migrate exited 0,
  app log clean; live site 200 and serving the new panel and removed-session
  strings (checked in the served page, no rooms created in production); 7 other
  sites 200; only the when-we-meet app and cleanup containers restarted (uptime
  diff against a pre-deploy snapshot). Stays ACTIVE pending Owner sign-off after
  trying it live.
- 2026-09-13 — **M2 reached (commit bda591c).** Owner-only Participants panel under
  the grid with type-to-confirm removal; the server stays the authority (the form
  doesn't re-check the name). EN/RU/CS/DE. Own review found and fixed two issues
  before commit: the English label didn't show where the name ends (now quoted,
  like the other three languages), and Cancel dropped keyboard focus (now returns
  to the row's Remove button). Verified: unit 82/82; e2e 11/11 with no retries,
  3 new (full removal flow incl. results and the removed browser's next save;
  server refusals for a wrong name, a target who already left, and a browser that
  stopped being owner; phone width with a long name, by tap); tsc and eslint
  clean; phone and desktop screenshots checked by eye. Codex review attempted,
  did not run (usage limit). Not covered by any test: the `self` and `roomGone`
  refusals, which no UI path can trigger. **PENDING APPROVAL:** deploy to
  meet.app.julienika.cz — leaves the workspace — logged 2026-09-13. Approved
  and done 2026-09-13, see the entry above.
- 2026-09-13 — **M1 reached (commit 3619a36).** `removeParticipant` action
  with every AC 1–3 check inside a room-row-locked transaction (D010);
  `leaveRoom` moved under the same lock. `saveAvailability` takes the expected
  participant id and returns `removed`/`mismatch` codes; the grid re-renders
  from the server on either and is keyed by participant id (found by the new
  e2e: without the key, the previous person's marks survived the re-render).
  Verified: unit 82/82 (7 new), e2e 8/8 (2 new: removed-session and identity-
  mismatch save paths), tsc/eslint clean. Not verified: the action itself has
  no UI until M2, so its refusal branches are covered by types and reading,
  not by a test — M2's panel e2e closes that. Not deployed. **Stopping at the
  milestone boundary — awaiting Owner approval to start M2.**
- 2026-09-13 — goal created and planned with the Owner; design put through
  a Codex critique exchange together with G-004 (outcome under G-004).
