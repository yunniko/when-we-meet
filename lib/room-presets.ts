// Shared between the create-room form (client) and createRoom (server) so
// the preset -> hour-range mapping only lives in one place. "custom" isn't
// here — its hours come straight from the form's dayStartHour/dayEndHour
// inputs instead of a fixed pair. No display label here on purpose — hours
// are locale-invariant digits (formatted via lib/slots.ts::formatHoursWindow)
// but the preset's name ("Evening", "Whole day", ...) is translated; see
// messages/en.json's CreateRoom.presets namespace, composed at render time
// in create-room-form.tsx.
export type DailyPresetKey = "evening" | "wholeDay" | "morning" | "midday" | "custom";

export const DAILY_PRESETS: Record<
  Exclude<DailyPresetKey, "custom">,
  { start: number; end: number }
> = {
  evening: { start: 17, end: 22 },
  wholeDay: { start: 7, end: 22 },
  morning: { start: 7, end: 12 },
  midday: { start: 12, end: 17 },
};

export function isPresetKey(value: string): value is DailyPresetKey {
  return value === "custom" || value in DAILY_PRESETS;
}
