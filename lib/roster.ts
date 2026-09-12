// Pure name rules shared by joining, removal and (later) the invited-names
// list. One definition of "the same name" so the join-time uniqueness key
// and the owner's type-to-confirm check can never drift apart.

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
