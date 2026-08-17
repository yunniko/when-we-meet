import { z } from "zod";

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
    timezone: z.string().min(1, "Pick a timezone"),
    startDate: z.string().date(),
    endDate: z.string().date(),
    dayStartHour: z.coerce.number().int().min(0).max(23),
    dayEndHour: z.coerce.number().int().min(1).max(24),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "End date must be on or after the start date",
    path: ["endDate"],
  })
  .refine((v) => v.dayEndHour > v.dayStartHour, {
    message: "Daily end time must be after the daily start time",
    path: ["dayEndHour"],
  })
  .refine(
    (v) => {
      const days =
        (Date.parse(v.endDate) - Date.parse(v.startDate)) / 86_400_000;
      return days <= 60;
    },
    {
      message: "Planning range can't be longer than 60 days",
      path: ["endDate"],
    },
  );

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
