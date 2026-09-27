import { describe, expect, it } from "vitest";
import {
  applyBrush,
  applyHistorySide,
  cellsBetween,
  historySideToUpdates,
  HISTORY_LIMIT,
  parseSlotKey,
  preferStrokeSets,
  pushHistory,
  type HistoryEntry,
  type Marks,
} from "@/lib/paint";

const CAN = { status: "CAN", preferred: false } as const;
const CAN_STAR = { status: "CAN", preferred: true } as const;
const CANNOT = { status: "CANNOT", preferred: false } as const;

describe("applyBrush", () => {
  it("marks an empty cell CAN and reports the change", () => {
    const res = applyBrush({}, "2027-01-15", 9, "CAN", true);
    expect(res.marks).toEqual({ "2027-01-15T9": CAN });
    expect(res.change).toEqual({ date: "2027-01-15", hour: 9, status: "CAN", preferred: false });
  });

  it("is a no-op when repainting CAN over CAN (no change, same object)", () => {
    const marks: Marks = { "2027-01-15T9": CAN };
    const res = applyBrush(marks, "2027-01-15", 9, "CAN", true);
    expect(res.change).toBeNull();
    expect(res.marks).toBe(marks);
  });

  it("keeps the star when repainting CAN over a preferred CAN, still a no-op", () => {
    const marks: Marks = { "2027-01-15T9": CAN_STAR };
    const res = applyBrush(marks, "2027-01-15", 9, "CAN", true);
    expect(res.change).toBeNull();
    expect(res.marks).toBe(marks);
  });

  it("is a no-op when repainting CANNOT over CANNOT", () => {
    const marks: Marks = { "2027-01-15T9": CANNOT };
    expect(applyBrush(marks, "2027-01-15", 9, "CANNOT", true).change).toBeNull();
  });

  it("drops the star when painting CANNOT over a preferred CAN", () => {
    const res = applyBrush({ "2027-01-15T9": CAN_STAR }, "2027-01-15", 9, "CANNOT", true);
    expect(res.change).toEqual({ date: "2027-01-15", hour: 9, status: "CANNOT", preferred: false });
  });

  it("CLEAR removes a marked cell and is a no-op on an empty one", () => {
    const cleared = applyBrush({ "2027-01-15T9": CAN }, "2027-01-15", 9, "CLEAR", true);
    expect(cleared.marks).toEqual({});
    expect(cleared.change).toEqual({ date: "2027-01-15", hour: 9, status: null, preferred: false });

    const empty: Marks = {};
    const noop = applyBrush(empty, "2027-01-15", 9, "CLEAR", true);
    expect(noop.change).toBeNull();
    expect(noop.marks).toBe(empty);
  });

  it("PREFER only applies to CAN cells and only when it changes the star", () => {
    expect(applyBrush({}, "2027-01-15", 9, "PREFER", true).change).toBeNull();
    expect(applyBrush({ "2027-01-15T9": CANNOT }, "2027-01-15", 9, "PREFER", true).change).toBeNull();
    expect(applyBrush({ "2027-01-15T9": CAN_STAR }, "2027-01-15", 9, "PREFER", true).change).toBeNull();

    const set = applyBrush({ "2027-01-15T9": CAN }, "2027-01-15", 9, "PREFER", true);
    expect(set.change).toEqual({ date: "2027-01-15", hour: 9, status: "CAN", preferred: true });
    const unset = applyBrush({ "2027-01-15T9": CAN_STAR }, "2027-01-15", 9, "PREFER", false);
    expect(unset.change).toEqual({ date: "2027-01-15", hour: 9, status: "CAN", preferred: false });
  });

  it("does not mutate the input marks", () => {
    const marks: Marks = { "2027-01-15T9": CAN };
    applyBrush(marks, "2027-01-15", 10, "CAN", true);
    expect(marks).toEqual({ "2027-01-15T9": CAN });
  });
});

describe("preferStrokeSets", () => {
  it("clears only when starting on an already-starred CAN cell", () => {
    expect(preferStrokeSets(undefined)).toBe(true);
    expect(preferStrokeSets(CAN)).toBe(true);
    expect(preferStrokeSets(CANNOT)).toBe(true);
    expect(preferStrokeSets(CAN_STAR)).toBe(false);
  });
});

describe("cellsBetween", () => {
  it("returns just the target for the first cell of a stroke", () => {
    expect(cellsBetween(null, { dateIdx: 2, hourIdx: 3 })).toEqual([{ dateIdx: 2, hourIdx: 3 }]);
  });

  it("fills the skipped cells along the longer axis, excluding the start", () => {
    expect(cellsBetween({ dateIdx: 0, hourIdx: 0 }, { dateIdx: 3, hourIdx: 1 })).toEqual([
      { dateIdx: 1, hourIdx: 0 },
      { dateIdx: 2, hourIdx: 1 },
      { dateIdx: 3, hourIdx: 1 },
    ]);
  });

  it("returns nothing when the pointer stays on the same cell", () => {
    expect(cellsBetween({ dateIdx: 1, hourIdx: 1 }, { dateIdx: 1, hourIdx: 1 })).toEqual([]);
  });
});

describe("parseSlotKey", () => {
  it("splits a slotKey back into its date and hour", () => {
    expect(parseSlotKey("2027-01-15T9")).toEqual({ date: "2027-01-15", hour: 9 });
    expect(parseSlotKey("2027-12-01T21")).toEqual({ date: "2027-12-01", hour: 21 });
  });
});

describe("applyHistorySide", () => {
  it("sets marked slots and deletes null (empty) ones", () => {
    const marks: Marks = { "2027-01-15T9": CAN };
    const next = applyHistorySide(marks, {
      "2027-01-15T9": null,
      "2027-01-15T10": CANNOT,
    });
    expect(next).toEqual({ "2027-01-15T10": CANNOT });
    expect(marks).toEqual({ "2027-01-15T9": CAN }); // input untouched
  });

  it("survives a JSON round-trip (localStorage) without losing an empty slot", () => {
    // Regression test: an object property whose value is `undefined` is
    // silently dropped by JSON.stringify, which would make an "this slot
    // was empty" entry vanish across a reload. `null` must not have that
    // problem — this is exactly why HistoryEntry uses it instead.
    const side = { "2027-01-15T9": null, "2027-01-15T10": CAN };
    const roundTripped = JSON.parse(JSON.stringify(side));
    expect(Object.keys(roundTripped)).toHaveLength(2);
    const marks: Marks = { "2027-01-15T9": CAN };
    expect(applyHistorySide(marks, roundTripped)).toEqual({ "2027-01-15T10": CAN });
  });
});

describe("historySideToUpdates", () => {
  it("converts a history side into the SlotUpdate batch saveAvailability expects", () => {
    const updates = historySideToUpdates({
      "2027-01-15T9": CAN,
      "2027-01-15T10": null,
    });
    expect(updates).toEqual(
      expect.arrayContaining([
        { date: "2027-01-15", hour: 9, status: "CAN", preferred: false },
        { date: "2027-01-15", hour: 10, status: null, preferred: false },
      ]),
    );
    expect(updates).toHaveLength(2);
  });
});

describe("pushHistory", () => {
  const entry = (n: number): HistoryEntry => ({
    before: {},
    after: { [`2027-01-15T${n}`]: CAN },
  });

  it("appends under the limit", () => {
    const stack = [entry(1), entry(2)];
    expect(pushHistory(stack, entry(3))).toEqual([entry(1), entry(2), entry(3)]);
  });

  it("drops the oldest entry once past HISTORY_LIMIT", () => {
    const stack = Array.from({ length: HISTORY_LIMIT }, (_, i) => entry(i));
    const next = pushHistory(stack, entry(HISTORY_LIMIT));
    expect(next).toHaveLength(HISTORY_LIMIT);
    expect(next[0]).toEqual(entry(1)); // entry(0) fell off the front
    expect(next[next.length - 1]).toEqual(entry(HISTORY_LIMIT));
  });
});
