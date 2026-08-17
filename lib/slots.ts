// Pure date/hour helpers. Deliberately no timezone conversion anywhere in
// here — dates are handled as UTC-midnight `Date` objects standing in for a
// plain calendar date (see HANDOVER D2), and hours are plain 0-23 integers.

export type SlotStatus = "CAN" | "CANNOT";

export type SlotKey = `${string}T${number}`;

export function slotKey(date: string, hour: number): SlotKey {
  return `${date}T${hour}`;
}

// dateOnly() -> "YYYY-MM-DD" from a Date, using UTC fields so a Prisma
// `@db.Date` value (always midnight UTC) round-trips without drifting a day
// in either direction regardless of server-local timezone.
export function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function enumerateDates(startDate: Date, endDate: Date): string[] {
  const dates: string[] = [];
  const cur = new Date(
    Date.UTC(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth(),
      startDate.getUTCDate(),
    ),
  );
  const end = new Date(
    Date.UTC(
      endDate.getUTCFullYear(),
      endDate.getUTCMonth(),
      endDate.getUTCDate(),
    ),
  );
  while (cur.getTime() <= end.getTime()) {
    dates.push(dateOnly(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

export function enumerateHours(dayStartHour: number, dayEndHour: number): number[] {
  const hours: number[] = [];
  for (let h = dayStartHour; h < dayEndHour; h++) hours.push(h);
  return hours;
}

export function formatHour(hour: number): string {
  const h = hour % 24;
  return `${String(h).padStart(2, "0")}:00`;
}

export function formatDateRange(startDate: Date, endDate: Date): string {
  const start = dateOnly(startDate);
  const end = dateOnly(endDate);
  return start === end ? start : `${start} – ${end}`;
}

export function formatHoursWindow(dayStartHour: number, dayEndHour: number): string {
  if (dayStartHour === 0 && dayEndHour === 24) return "Whole day";
  return `${formatHour(dayStartHour)}–${String(dayEndHour).padStart(2, "0")}:00`;
}

export function formatDayLabel(date: string): string {
  // date is "YYYY-MM-DD"; parse as UTC noon to dodge any DST edge shifting
  // the displayed weekday in the server's local timezone.
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString(undefined, {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export type AvailabilityRow = {
  slotDate: Date;
  slotHour: number;
  status: SlotStatus;
  preferred: boolean;
};

export type CellMark = { status: SlotStatus; preferred: boolean };

export type MarkSummary = {
  canCount: number;
  cannotCount: number;
  byDate: { date: string; canCount: number; cannotCount: number }[];
};

export function summarizeAvailability(rows: AvailabilityRow[]): MarkSummary {
  const byDateMap = new Map<string, { canCount: number; cannotCount: number }>();
  let canCount = 0;
  let cannotCount = 0;
  for (const row of rows) {
    const date = dateOnly(row.slotDate);
    const entry = byDateMap.get(date) ?? { canCount: 0, cannotCount: 0 };
    if (row.status === "CAN") {
      entry.canCount++;
      canCount++;
    } else {
      entry.cannotCount++;
      cannotCount++;
    }
    byDateMap.set(date, entry);
  }
  const byDate = [...byDateMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date, ...counts }));
  return { canCount, cannotCount, byDate };
}
