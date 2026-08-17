import { z } from "zod";

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
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "endBeforeStart",
    path: ["endDate"],
  })
  .refine((v) => v.dayEndHour > v.dayStartHour, {
    message: "dayEndBeforeStart",
    path: ["dayEndHour"],
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
