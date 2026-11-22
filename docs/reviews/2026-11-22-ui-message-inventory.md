# UI message inventory — ui-kit pilot (2026-11-22)

Every user-facing message the ui-kit pilot changed, with the reason, so the next review starts from this
list rather than from memory. Base `b65a0b2`, pilot commits `4aefe68`..`5f0d7f8`. English figures; the
other three locales were rewritten to the same meaning (parity enforced by `tests/unit/messages-parity.spec.ts`).

**Totals.** UI copy (all namespaces except the About/Legal page content): 5,228 → 4,598 characters (−12%),
170 → 177 keys (more keys because each message now names its kind: `…Hint`, `…Status`, `errors.*`,
`confirm.*`). `node scripts/ui-kit/ui-check.mjs --inventory` lists the current set with kinds and lengths.

## Removed (said nothing the screen did not already say)

| Key | Was | Why |
|---|---|---|
| `JoinForm.intro` | a 4-sentence paragraph above the name field | restated the page; the one fact users need is now `nameHint` |
| `JoinForm.nameHelp` | 2 sentences on uniqueness and other devices | uniqueness is enforced by the collision flow; the device fact became `nameHint` |
| `CreateRoom.invitedHelp`, `timezoneHelp` | 2 long helps | cut to one-line hints (`invitedHint`, `timezoneHint`) |
| `ResultsBoard.legend.preferHint` | "★N = N prefer this slot" | shortened to `legend.prefer`; "this slot" is where the star is |

## Moved (same information, a different place or kind)

| From | To | Why |
|---|---|---|
| `AvailabilityGrid.instructions` (always shown, 5 lines at 390px) | `instructionsHint` (one line) + `instructionsDetail` in an `InlineHelp` | the everyday action stays visible; touch, bulk-fill and Prefer rules on demand (D019) |
| grid `saving`/`saved`/`saveError`/`removed` in a hand-made span | `StatusSlot` with `…Status` keys and `errors.save` | one reserved, announced slot (D015) |
| `LeaveRoom.warning`/`confirm`, `ParticipantsPanel.warning`/`typeToConfirm` | `confirm.{title,body,action}` in `ConfirmDialog` | one dialog pattern, cancel focused first |
| `RoomPage.closedMessage`, `ResultsBoard.noSlotsYet`, `ParticipantsPanel.nobodyElse` | `EmptyState` (`closedEmpty`, `slotsEmpty`, `empty`) | one empty-state pattern |
| results error banner, create-form `role=alert` banner | `StatusSlot` under the action | in place, nothing above the content moves |
| start/end date errors, each in a half-width slot | one full-width `FieldGroup` slot (`datesLegend`) | the error wrapped at 390px and moved the form 20–40px (D020) |

## Kept, shortened

`joinRule*` option labels, `fill*Title` tooltips, `ownerHint`, `clickToPick`, `joinedOfExpected`,
`notYou`, `endBeforeStart`, `rangeTooLong`, `descriptionPlaceholder`: same meaning, fewer words; the
date errors now fit one line at 390px in all four locales (`tests/e2e/ui-quality.spec.ts`).

M5 calibration (D021): every message a slot reserves space for now fits one line at 360px in all four
locales. Shortened, in the locales where they wrapped: `CreateRoom` `dayEndBeforeStart`, `listedOnlyNeedsNames`,
`invitedNameTooLong`, `tooManyInvitedNames`, `invalidInput`, `timezoneHint`; `JoinForm` `confirmFailed`,
`notOnList`, `roomFull`; `LeaveRoom.ruleChanged`; `ParticipantsPanel` `addFailed`, `full`, `tooManyInvitedNames`,
`ruleFailed`, `failed`, `self`, `notOwner`, `roomGone`, `claimed`, `nameMismatch`, `invitedNameTooLong`;
`AvailabilityGrid` `errors.save`, `removedStatus`; `ResultsBoard` `notOwner`, `outOfRange`, `notFuture`. A hint that
shares no slot with an error is always visible and was left as written.

## Added

`gridLabel` (×2) names the scrollable grid regions for screen readers (axe `scrollable-region-focusable`);
`collision.isThisYouTitle` is now a heading; the previously unrendered `dayStartHour` error is shown.

## Not done here

The availability grid is pointer-only: no keyboard way to mark a slot (WCAG 2.1.1). Listed for the
Owner in `HANDOVER.md`; it is a feature, not a message change.

After ui-kit D009 (6% headroom) these were shortened as well: en `ParticipantsPanel.errors.self` and
`invitedNameTooLong`; ru `CreateRoom.errors.listedOnlyNeedsNames`, `ParticipantsPanel.errors.failed`,
`invitedNameTooLong`, `addFailed`, `ruleFailed`; cs `listedOnlyNeedsNames`, `LeaveRoom.errors.ruleChanged`; de
`JoinForm.errors.confirmFailed`, `notOnList`, `LeaveRoom.errors.ruleChanged`.

Linux CI renders about 5% wider than Windows, so the 6% headroom is in effect about 11% there; these were
shortened for it: cs `AvailabilityGrid.errors.save`, `ParticipantsPanel.errors.notOwner`, `self`,
`invitedNameTooLong`; de `CreateRoom.errors.endBeforeStart`, `dayEndBeforeStart`, `rangeTooLong`,
`ParticipantsPanel.errors.roomGone`, `full`; en `JoinForm.errors.confirmFailed`,
`AvailabilityGrid.removedStatus`, `ParticipantsPanel.errors.ruleFailed`; ru `CreateRoom.errors.endBeforeStart`,
`rangeTooLong`, `tooManyInvitedNames`.
