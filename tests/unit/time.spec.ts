import { describe, expect, it } from "vitest";
import { isSlotInFuture, nowInTimezone } from "@/lib/time";

describe("nowInTimezone", () => {
  it("reads the wall-clock date/hour in the given IANA zone", () => {
    // 2026-08-21T10:30:00Z is 12:30 in Europe/Prague (UTC+2 in August).
    const at = new Date("2026-08-21T10:30:00Z");
    expect(nowInTimezone("Europe/Prague", at)).toEqual({ date: "2026-08-21", hour: 12 });
  });

  it("rolls over to the next UTC date correctly for a positive-offset zone", () => {
    // 2026-08-21T23:00:00Z is 2026-08-22 08:00 in Asia/Tokyo (UTC+9).
    const at = new Date("2026-08-21T23:00:00Z");
    expect(nowInTimezone("Asia/Tokyo", at)).toEqual({ date: "2026-08-22", hour: 8 });
  });

  it("rolls back to the previous UTC date correctly for a negative-offset zone", () => {
    // 2026-08-21T02:00:00Z is 2026-08-20 22:00 in America/New_York (UTC-4 in August, EDT).
    const at = new Date("2026-08-21T02:00:00Z");
    expect(nowInTimezone("America/New_York", at)).toEqual({ date: "2026-08-20", hour: 22 });
  });
});

describe("isSlotInFuture", () => {
  const at = new Date("2026-08-21T10:00:00Z"); // 12:00 in Europe/Prague

  it("is true for a later hour on the same day", () => {
    expect(isSlotInFuture("2026-08-21", 13, "Europe/Prague", at)).toBe(true);
  });

  it("is false for the current hour (not strictly future)", () => {
    expect(isSlotInFuture("2026-08-21", 12, "Europe/Prague", at)).toBe(false);
  });

  it("is false for an earlier hour on the same day", () => {
    expect(isSlotInFuture("2026-08-21", 9, "Europe/Prague", at)).toBe(false);
  });

  it("is true for any hour on a later day", () => {
    expect(isSlotInFuture("2026-08-22", 0, "Europe/Prague", at)).toBe(true);
  });

  it("is false for any hour on an earlier day", () => {
    expect(isSlotInFuture("2026-08-20", 23, "Europe/Prague", at)).toBe(false);
  });
});
