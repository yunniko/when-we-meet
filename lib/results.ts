import { dateOnly, slotKey, type AvailabilityRow } from "@/lib/slots";

export type SlotResult = {
  date: string;
  hour: number;
  canCount: number;
  cannotCount: number;
  preferredCount: number;
  totalParticipants: number;
  isFullGroup: boolean;
};

// Pure aggregation: given every Availability row in a room (across all
// participants) and the full slot grid, count CAN/CANNOT/preferred per slot
// and rank slots by availability first, preferred overlap second. A slot
// nobody has marked still appears (zero counts) so the grid stays complete.
export function computeResults(
  dates: string[],
  hours: number[],
  totalParticipants: number,
  rows: AvailabilityRow[],
): SlotResult[] {
  const counts = new Map<string, { can: number; cannot: number; preferred: number }>();
  for (const row of rows) {
    const key = slotKey(dateOnly(row.slotDate), row.slotHour);
    const entry = counts.get(key) ?? { can: 0, cannot: 0, preferred: 0 };
    if (row.status === "CAN") {
      entry.can++;
      if (row.preferred) entry.preferred++;
    } else {
      entry.cannot++;
    }
    counts.set(key, entry);
  }

  const results: SlotResult[] = [];
  for (const date of dates) {
    for (const hour of hours) {
      const c = counts.get(slotKey(date, hour)) ?? { can: 0, cannot: 0, preferred: 0 };
      results.push({
        date,
        hour,
        canCount: c.can,
        cannotCount: c.cannot,
        preferredCount: c.preferred,
        totalParticipants,
        isFullGroup: totalParticipants > 0 && c.can === totalParticipants,
      });
    }
  }

  return results.sort(
    (a, b) =>
      b.canCount - a.canCount ||
      b.preferredCount - a.preferredCount ||
      a.date.localeCompare(b.date) ||
      a.hour - b.hour,
  );
}
