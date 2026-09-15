// Pure participant rules shared by joining, claiming, leaving, removal and
// the invited-names list (G-003, G-004). No database access here:
// lib/membership.ts applies these under the room lock (D010), and
// tests/unit/roster.spec.ts pins them.

export type JoinRuleValue = "ANYONE" | "LISTED_ONLY";

type Member = { id: string; joinedAt: Date | null; createdAt: Date };

// The per-room uniqueness key for a display name: trimmed and lowercased.
// Matches Participant.nameKey in the schema.
export function nameKeyOf(name: string): string {
  return name.trim().toLowerCase();
}

// Type-to-confirm rule for removing a participant (G-003): the typed text
// must be the target's name up to leading/trailing whitespace and case.
// Empty input never matches, even against an (impossible) empty name.
export function confirmationMatches(typed: string, targetName: string): boolean {
  const key = nameKeyOf(typed);
  return key.length > 0 && key === nameKeyOf(targetName);
}

// Leaving under "anyone can join" deletes the participant. Under "listed
// names only" the name stays on the list as unclaimed (marks deleted,
// cookie token rotated), so the leaver can claim it again rather than being
// locked out of a room that refuses new names (G-004 AC6).
export function leaveEffect(rule: JoinRuleValue): "delete" | "reset" {
  return rule === "LISTED_ONLY" ? "reset" : "delete";
}

function compareJoinOrder(a: Member, b: Member): number {
  return (
    (a.joinedAt?.getTime() ?? 0) - (b.joinedAt?.getTime() ?? 0) ||
    compareCreationOrder(a, b)
  );
}

function compareCreationOrder(a: Member, b: Member): number {
  return a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

// Who inherits ownership when the owner leaves: the participant who joined
// earliest, never an unclaimed invited name and never the person leaving.
// Equal join times fall back to creation order, then id, so the choice is
// deterministic.
export function pickSuccessor<T extends Member>(members: T[], leavingId: string): T | null {
  let best: T | null = null;
  for (const m of members) {
    if (m.id === leavingId || m.joinedAt === null) continue;
    if (!best || compareJoinOrder(m, best) < 0) best = m;
  }
  return best;
}

// Whether a participant who has just joined or claimed a name becomes the
// room's owner (D007, D011). A room with an owner never changes hands this
// way. A vacant room (its owner left with nobody joined to inherit) goes to
// whoever joins next. Otherwise only the browser that created the room,
// proven by its owner-token cookie, is tagged.
export function shouldBecomeOwner(
  room: { creatorParticipantId: string | null; ownershipVacant: boolean; ownerToken: string },
  presentedOwnerToken: string | undefined,
): boolean {
  if (room.creatorParticipantId !== null) return false;
  if (room.ownershipVacant) return true;
  return presentedOwnerToken !== undefined && presentedOwnerToken === room.ownerToken;
}

// Whether joining may add a name that isn't in the room yet. Under "listed
// names only" just the browser that created the room may (G-004 AC3), so
// the creator is never locked out of their own room.
export function mayAddNewName(
  room: { joinRule: JoinRuleValue; ownerToken: string },
  presentedOwnerToken: string | undefined,
): boolean {
  if (room.joinRule === "ANYONE") return true;
  return presentedOwnerToken !== undefined && presentedOwnerToken === room.ownerToken;
}

// Which of the owner's new invited names to add (G-004 M3): names already in
// the room, joined or invited, are skipped (case-insensitively, as are
// repeats within the list), and overBy says how far the rest would take the
// room past its cap.
export function planInvitedAdditions(
  existingNameKeys: string[],
  names: string[],
  max: number,
): { add: string[]; skipped: string[]; overBy: number } {
  const taken = new Set(existingNameKeys);
  const add: string[] = [];
  const skipped: string[] = [];
  for (const name of names) {
    const key = nameKeyOf(name);
    if (taken.has(key)) {
      skipped.push(name);
      continue;
    }
    taken.add(key);
    add.push(name);
  }
  return { add, skipped, overBy: Math.max(0, existingNameKeys.length + add.length - max) };
}

// Joined participants in join order, and unclaimed invited names in the
// order the owner added them.
export function splitRoster<T extends Member>(members: T[]): { joined: T[]; invited: T[] } {
  return {
    joined: members.filter((m) => m.joinedAt !== null).sort(compareJoinOrder),
    invited: members.filter((m) => m.joinedAt === null).sort(compareCreationOrder),
  };
}
