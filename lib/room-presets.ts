// Shared between the create-room form (client) and createRoom (server) so
// the preset -> hour-range mapping only lives in one place. "custom" isn't
// here — its hours come straight from the form's dayStartHour/dayEndHour
// inputs instead of a fixed pair.
export type DailyPresetKey = "evening" | "wholeDay" | "morning" | "midday" | "custom";

export const DAILY_PRESETS: Record<
  Exclude<DailyPresetKey, "custom">,
  { label: string; start: number; end: number }
> = {
  evening: { label: "Evening (17:00–22:00)", start: 17, end: 22 },
  wholeDay: { label: "Whole day (07:00–22:00)", start: 7, end: 22 },
  morning: { label: "Morning (07:00–12:00)", start: 7, end: 12 },
  midday: { label: "Midday (12:00–17:00)", start: 12, end: 17 },
};

export function isPresetKey(value: string): value is DailyPresetKey {
  return value === "custom" || value in DAILY_PRESETS;
}
