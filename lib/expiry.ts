// A room is removed 3 days after whichever is the relevant "end" date: the
// creator's finalized meeting date if one was picked, otherwise the last day
// of the planning range. This is a coarse, UTC-calendar-day cleanup policy
// (not timezone-aware like slot display) — precision doesn't matter for a
// cleanup grace period. See HANDOVER D6.
const GRACE_DAYS = 3;

export function roomExpiryDate(room: { endDate: Date; selectedDate: Date | null }): Date {
  const base = room.selectedDate ?? room.endDate;
  const expiry = new Date(base);
  expiry.setUTCDate(expiry.getUTCDate() + GRACE_DAYS);
  return expiry;
}

export function isRoomExpired(
  room: { endDate: Date; selectedDate: Date | null },
  now: Date = new Date(),
): boolean {
  return now.getTime() >= roomExpiryDate(room).getTime();
}
