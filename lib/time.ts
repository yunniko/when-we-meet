// "Now" expressed as a plain wall-clock (date, hour) pair in a given IANA
// timezone. This is the one place real timezone conversion happens in the
// app — everywhere else, slots are stored/compared as plain wall-clock
// values with no conversion (see HANDOVER D2). Converting "now" into a
// timezone's local wall-clock reading (rather than converting stored slots
// between zones) doesn't reintroduce that complexity; it's a one-way read.
export function nowInTimezone(
  timeZone: string,
  at: Date = new Date(),
): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const hour = Number(get("hour")) % 24;
  return { date, hour };
}

export function isSlotInFuture(
  date: string,
  hour: number,
  timeZone: string,
  at: Date = new Date(),
): boolean {
  const now = nowInTimezone(timeZone, at);
  if (date !== now.date) return date > now.date;
  return hour > now.hour;
}
