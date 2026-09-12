import { describe, expect, it } from "vitest";
import { applyBrush, cellsBetween, preferStrokeSets, type Marks } from "@/lib/paint";

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
