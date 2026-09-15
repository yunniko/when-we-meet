import { z } from "zod";
import { nameKeyOf } from "@/lib/roster";

// Raw size of an invited-names box, before parsing (see invitedNames below).
export const MAX_INVITED_TEXT_LENGTH = 25_000;

// Every error message below is an i18n KEY (looked up as
// `CreateRoom.errors.<key>` client-side via useTranslations), not an English
// sentence — this schema runs at module scope, outside any request/locale
// context, so it can't translate messages itself. See create-room-form.tsx
// and messages/en.json's CreateRoom.errors namespace.
//
// Hour-of-day bounds: 0-24, end exclusive (24 = through 23:00-24:00), and
// end must be strictly after start so the window isn't empty.
export const createRoomSchema = z
  .object({
    title: z
      .string()
      .trim()
      .max(120)
      .optional()
      .transform((v) => (v ? v : undefined)),
    description: z
      .string()
      .trim()
      .max(2000, "descriptionTooLong")
      .optional()
      .transform((v) => (v ? v : undefined)),
    timezone: z.string().min(1, "timezoneRequired"),
    startDate: z.string().date("startDateInvalid"),
    endDate: z.string().date("endDateInvalid"),
    dayStartHour: z.coerce
      .number("dayHourInvalid")
      .int("dayHourInvalid")
      .min(0, "dayStartHourRange")
      .max(23, "dayStartHourRange"),
    dayEndHour: z.coerce
      .number("dayHourInvalid")
      .int("dayHourInvalid")
      .min(1, "dayEndHourRange")
      .max(24, "dayEndHourRange"),
    // One name per line (G-004), parsed, trimmed and deduplicated here so
    // the action only ever sees a clean list. See parseInvitedNames below.
    // The raw ceiling only bounds parsing work: the real limits (60
    // characters, 99 distinct names) apply after deduplication, so a list
    // pasted twice still passes.
    invitedNames: z
      .string()
      .max(MAX_INVITED_TEXT_LENGTH, "tooManyInvitedNames")
      .optional()
      .transform((value, ctx) => {
        const parsed = parseInvitedNames(value ?? "");
        if (!parsed.ok) {
          ctx.addIssue({ code: "custom", message: parsed.error });
          return z.NEVER;
        }
        return parsed.names;
      }),
    joinRule: z
      .enum(["ANYONE", "LISTED_ONLY"], "joinRuleInvalid")
      .optional()
      .transform((value) => value ?? "ANYONE"),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "endBeforeStart",
    path: ["endDate"],
  })
  .refine((v) => v.dayEndHour > v.dayStartHour, {
    message: "dayEndBeforeStart",
    path: ["dayEndHour"],
  })
  // A listed-only room with nobody listed would admit only its creator.
  .refine((v) => v.joinRule === "ANYONE" || v.invitedNames.length > 0, {
    message: "listedOnlyNeedsNames",
    path: ["joinRule"],
  })
  .refine(
    (v) => {
      const days =
        (Date.parse(v.endDate) - Date.parse(v.startDate)) / 86_400_000;
      return days <= 60;
    },
    {
      message: "rangeTooLong",
      path: ["endDate"],
    },
  );

export type CreateRoomInput = z.infer<typeof createRoomSchema>;

// A cheap defensive backstop against scripted join-spam — this app has no
// accounts/CAPTCHA by design (see AGENTS.md), so nothing else stops a script
// with a room link from creating unlimited throwaway participants. Not a
// limit real group usage would ever approach.
export const MAX_PARTICIPANTS_PER_ROOM = 100;

// Longest display name, for joining and for invited names alike.
export const MAX_NAME_LENGTH = 60;

// Invited names leave one place under the cap, so the creator can always
// join their own room (G-004 AC1).
export const MAX_INVITED_NAMES = MAX_PARTICIPANTS_PER_ROOM - 1;

export type InvitedNamesResult =
  | { ok: true; names: string[] }
  | { ok: false; error: "invitedNameTooLong" | "tooManyInvitedNames" };

// Parses the creation form's "Invited people" box: one name per line,
// trimmed, blank lines skipped, duplicates dropped (case-insensitive, the
// same rule as joining) keeping the first spelling. Error values are i18n
// keys under CreateRoom.errors.
export function parseInvitedNames(text: string): InvitedNamesResult {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const name = line.trim();
    if (!name) continue;
    if (name.length > MAX_NAME_LENGTH) return { ok: false, error: "invitedNameTooLong" };
    const key = nameKeyOf(name);
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  if (names.length > MAX_INVITED_NAMES) return { ok: false, error: "tooManyInvitedNames" };
  return { ok: true, names };
}
