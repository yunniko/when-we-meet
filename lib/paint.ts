// Pure brush logic for the availability grid. Kept out of the component so
// the "does this stroke actually change anything?" rule is unit-tested: only
// a real change produces a `SlotUpdate`, so repainting CAN over CAN (or
// clearing an empty cell) never triggers a save.

import { slotKey, type CellMark, type SlotStatus } from "@/lib/slots";

export type Brush = SlotStatus | "CLEAR" | "PREFER";

export type Marks = Record<string, CellMark>;

export type SlotUpdate = {
  date: string;
  hour: number;
  status: SlotStatus | null;
  preferred: boolean;
};

export type CellIndex = { dateIdx: number; hourIdx: number };

// A PREFER stroke sets or clears the star for its whole length, decided once
// from the first cell touched, so dragging over a mix of starred and
// unstarred CAN cells does not flip each one independently.
export function preferStrokeSets(first: CellMark | undefined): boolean {
  return !(first?.status === "CAN" && first.preferred);
}

function targetMark(
  current: CellMark | undefined,
  brush: Brush,
  preferSets: boolean,
): CellMark | undefined | "noop" {
  if (brush === "CLEAR") return undefined;
  if (brush === "PREFER") {
    // Only applies to CAN slots; anything else is left untouched.
    if (current?.status !== "CAN") return "noop";
    return { status: "CAN", preferred: preferSets };
  }
  // CAN / CANNOT: keep an existing star only when repainting CAN over CAN;
  // anything else forces it off (preferred only makes sense on a CAN slot).
  const preferred = brush === "CAN" && current?.status === "CAN" ? current.preferred : false;
  return { status: brush, preferred };
}

function sameMark(a: CellMark | undefined, b: CellMark | undefined): boolean {
  if (!a || !b) return a === b;
  return a.status === b.status && a.preferred === b.preferred;
}

// Paints one cell. When the brush would leave the cell as it is, returns the
// same `marks` object and `change: null`, and the caller must record nothing.
export function applyBrush(
  marks: Marks,
  date: string,
  hour: number,
  brush: Brush,
  preferSets: boolean,
): { marks: Marks; change: SlotUpdate | null } {
  const key = slotKey(date, hour);
  const current = marks[key];
  const target = targetMark(current, brush, preferSets);
  if (target === "noop" || sameMark(current, target)) return { marks, change: null };
  const next = { ...marks };
  if (target) next[key] = target;
  else delete next[key];
  return {
    marks: next,
    change: { date, hour, status: target?.status ?? null, preferred: target?.preferred ?? false },
  };
}

// Grid cells on the straight line from `from` (exclusive) to `to`
// (inclusive), stepping along whichever axis moved further, so a fast
// drag/swipe that skips intermediate cells still fills the gap. With no
// `from`, just `to`.
export function cellsBetween(from: CellIndex | null, to: CellIndex): CellIndex[] {
  if (!from) return [to];
  const dSteps = to.dateIdx - from.dateIdx;
  const hSteps = to.hourIdx - from.hourIdx;
  const steps = Math.max(Math.abs(dSteps), Math.abs(hSteps));
  const cells: CellIndex[] = [];
  for (let i = 1; i <= steps; i++) {
    cells.push({
      dateIdx: from.dateIdx + Math.round((dSteps * i) / steps),
      hourIdx: from.hourIdx + Math.round((hSteps * i) / steps),
    });
  }
  return cells;
}

// Undo/redo history for the grid. One entry per completed stroke (drag,
// tap, or a day/hour/grid fill): `before` is what each touched slot held
// right before the stroke, `after` is what it holds now — both keyed by
// slotKey(), `null` meaning empty. `null`, not `undefined`: an entry is
// persisted to localStorage via JSON.stringify, which silently *drops* any
// object property whose value is `undefined` — losing exactly the "this
// slot was empty" case and corrupting the entry on reload. Undo re-applies
// `before`; redo re-applies `after`.
export type HistoryEntry = {
  before: Partial<Record<string, CellMark | null>>;
  after: Partial<Record<string, CellMark | null>>;
};

// Caps the undo stack (and, separately, the redo stack) so a long editing
// session's localStorage entry can't grow without bound. 20 is generous for
// "undo my last few mistakes" while keeping the worst case bounded: a room
// can span at most 60 days x 24 hours (rangeTooLong caps it), so even 20
// consecutive whole-grid fills — an unrealistic worst case, since a fill
// only produces one entry regardless of how many slots it touches — stay
// well under a browser's localStorage quota (~5-10MB/origin).
export const HISTORY_LIMIT = 20;

export function pushHistory(stack: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  const next = [...stack, entry];
  return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next;
}

// Applies one side of a history entry (`before` for undo, `after` for redo)
// to `marks`, returning a new marks object.
export function applyHistorySide(marks: Marks, side: Partial<Record<string, CellMark | null>>): Marks {
  const next = { ...marks };
  for (const key of Object.keys(side)) {
    const mark = side[key];
    if (mark) next[key] = mark;
    else delete next[key];
  }
  return next;
}

// slotKey() is `${date}T${hour}`; date is always "YYYY-MM-DD" (10 chars),
// so it splits back out without needing a regex.
export function parseSlotKey(key: string): { date: string; hour: number } {
  return { date: key.slice(0, 10), hour: Number(key.slice(11)) };
}

// Converts one side of a history entry into the SlotUpdate[] batch
// saveAvailability expects, so undo/redo persist the same way a stroke does.
export function historySideToUpdates(side: Partial<Record<string, CellMark | null>>): SlotUpdate[] {
  return Object.keys(side).map((key) => {
    const { date, hour } = parseSlotKey(key);
    const mark = side[key];
    return { date, hour, status: mark?.status ?? null, preferred: mark?.preferred ?? false };
  });
}
