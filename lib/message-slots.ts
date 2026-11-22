// Which messages each message slot can show, so the kit sizes the slot for the longest of them and a longer
// one appearing moves nothing below it (ui-kit D007). Keys are relative to the component's namespace.
// `tests/unit/message-slots.spec.ts` fails when an error key in messages/en.json is in no list, so a new error
// cannot be added without a place reserved for it. Messages that embed a person's name are listed with an
// empty name: a name's length cannot be known in advance (the limit is recorded in ui-kit's calibration review).
// An error the browser's own constraints already stop (maxLength, required, min/max, a radio) is listed in
// BROWSER_PREVENTED instead: only a forged request reaches it, and reserving space for it would leave an empty
// gap on every honest visit.

export const MESSAGE_SLOTS = {
  CreateRoom: {
    dates: ["errors.endBeforeStart", "errors.rangeTooLong"],
    timezone: ["errors.timezoneRequired"],
    dailyWindow: ["errors.dayEndBeforeStart"],
    invitedNames: ["errors.invitedNameTooLong", "errors.tooManyInvitedNames"],
    joinRule: ["errors.listedOnlyNeedsNames"],
    form: ["errors.invalidInput"],
  },
  JoinForm: {
    name: ["errors.nameRequired", "errors.confirmFailed", "errors.roomFull", "errors.notOnList"],
  },
  ParticipantsPanel: {
    notice: ["ownerHint", "errors.notFound", "errors.claimed", "errors.roomGone", "errors.notOwner", "errors.self", "errors.failed"],
    removeConfirm: ["errors.nameMismatch", "errors.roomGone", "errors.notOwner", "errors.self", "errors.failed"],
    add: [
      "errors.invitedNameTooLong",
      "errors.tooManyInvitedNames",
      "errors.nothingToAdd",
      "errors.full",
      "errors.roomGone",
      "errors.notOwner",
      "errors.addFailed",
    ],
    joinRule: ["errors.roomGone", "errors.notOwner", "errors.ruleFailed"],
  },
  AvailabilityGrid: {
    save: ["savingStatus", "savedStatus", "errors.save", "removedStatus"],
  },
  LeaveRoom: {
    confirm: ["errors.ruleChanged"],
  },
  ResultsBoard: {
    pick: ["errors.roomNotFound", "errors.notOwner", "errors.invalidSlot", "errors.outOfRange", "errors.notFuture"],
  },
} as const;

/** Errors no honest visit reaches, each with the browser constraint that stops it. Not reserved. */
export const BROWSER_PREVENTED: Record<string, Record<string, string>> = {
  CreateRoom: {
    "errors.descriptionTooLong": "maxLength = MAX_DESCRIPTION_LENGTH",
    "errors.startDateInvalid": "type=date required",
    "errors.endDateInvalid": "type=date required",
    "errors.dayHourInvalid": "type=number required",
    "errors.dayStartHourRange": "min/max",
    "errors.dayEndHourRange": "min/max",
    "errors.joinRuleInvalid": "radio",
  },
  JoinForm: { "errors.nameTooLong": "maxLength = MAX_NAME_LENGTH" },
  ParticipantsPanel: { "errors.invalidRule": "radio" },
};

type Slots = typeof MESSAGE_SLOTS;

/** The translated messages for one slot, for the kit's `reserve` prop. `t` is the component's translator. */
export function reserveFor<N extends keyof Slots>(
  t: (key: string, values?: Record<string, string | number>) => string,
  namespace: N,
  slot: keyof Slots[N],
  values: Record<string, string | number> = {}
): string[] {
  const keys = MESSAGE_SLOTS[namespace][slot] as readonly string[];
  return keys.map((key) => t(key, { name: "", max: 0, count: 0, names: "", ...values }));
}
