import { dateOnly, slotKey, type AvailabilityRow } from "@/lib/slots";

export type SlotResult = {
  date: string;
  hour: number;
  canCount: number;
  cannotCount: number;
  preferredCount: number;
  totalParticipants: number;
  isFullGroup: boolean;
  // Everyone who did NOT mark CAN for this slot (explicit CANNOT or simply
  // unmarked) — shown next to a slot in "Best times" so a near-full slot
  // reads as "everyone but Bob" instead of just "3/4 can".
  missingNames: string[];
};

type NamedAvailabilityRow = AvailabilityRow & { participantName: string };

// Pure aggregation: given every participant's name, every Availability row
// in a room, and the full slot grid, count CAN/CANNOT/preferred per slot
// and rank slots by availability first, preferred overlap second. A slot
// nobody has marked still appears (zero counts) so the grid stays complete.
export function computeResults(
  dates: string[],
  hours: number[],
  participantNames: string[],
  rows: NamedAvailabilityRow[],
): SlotResult[] {
  const totalParticipants = participantNames.length;
  const counts = new Map<string, { can: number; cannot: number; preferred: number }>();
  const canNamesBySlot = new Map<string, Set<string>>();

  for (const row of rows) {
    const key = slotKey(dateOnly(row.slotDate), row.slotHour);
    const entry = counts.get(key) ?? { can: 0, cannot: 0, preferred: 0 };
    if (row.status === "CAN") {
      entry.can++;
      if (row.preferred) entry.preferred++;
      const canNames = canNamesBySlot.get(key) ?? new Set<string>();
      canNames.add(row.participantName);
      canNamesBySlot.set(key, canNames);
    } else {
      entry.cannot++;
    }
    counts.set(key, entry);
  }

  const results: SlotResult[] = [];
  for (const date of dates) {
    for (const hour of hours) {
      const key = slotKey(date, hour);
      const c = counts.get(key) ?? { can: 0, cannot: 0, preferred: 0 };
      const canNames = canNamesBySlot.get(key);
      results.push({
        date,
        hour,
        canCount: c.can,
        cannotCount: c.cannot,
        preferredCount: c.preferred,
        totalParticipants,
        isFullGroup: totalParticipants > 0 && c.can === totalParticipants,
        missingNames: participantNames.filter((name) => !canNames?.has(name)),
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
