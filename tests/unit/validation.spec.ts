import { describe, expect, it } from "vitest";
import { createRoomSchema } from "@/lib/validation";

const base = {
  title: "Camping trip",
  timezone: "Europe/Prague",
  startDate: "2026-08-21",
  endDate: "2026-08-23",
  dayStartHour: 9,
  dayEndHour: 17,
};

describe("createRoomSchema", () => {
  it("accepts a valid whole-range room", () => {
    const result = createRoomSchema.safeParse({ ...base, dayStartHour: 0, dayEndHour: 24 });
    expect(result.success).toBe(true);
  });

  it("accepts a single-day room (startDate === endDate)", () => {
    const result = createRoomSchema.safeParse({ ...base, endDate: base.startDate });
    expect(result.success).toBe(true);
  });

  it("trims whitespace-only titles to undefined", () => {
    const result = createRoomSchema.safeParse({ ...base, title: "   " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.title).toBeUndefined();
  });

  it("accepts an omitted description and trims a whitespace-only one to undefined", () => {
    const omitted = createRoomSchema.safeParse(base);
    expect(omitted.success).toBe(true);
    if (omitted.success) expect(omitted.data.description).toBeUndefined();

    const blank = createRoomSchema.safeParse({ ...base, description: "   " });
    expect(blank.success).toBe(true);
    if (blank.success) expect(blank.data.description).toBeUndefined();
  });

  it("keeps a real description and rejects one over 2000 characters", () => {
    const ok = createRoomSchema.safeParse({ ...base, description: "Bring snacks!" });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.description).toBe("Bring snacks!");

    const tooLong = createRoomSchema.safeParse({ ...base, description: "a".repeat(2001) });
    expect(tooLong.success).toBe(false);
  });

  it("rejects an end date before the start date", () => {
    const result = createRoomSchema.safeParse({ ...base, startDate: "2026-08-23", endDate: "2026-08-21" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("endDate"))).toBe(true);
    }
  });

  it("rejects a daily end hour at or before the daily start hour", () => {
    const result = createRoomSchema.safeParse({ ...base, dayStartHour: 17, dayEndHour: 17 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("dayEndHour"))).toBe(true);
    }
  });

  it("rejects a range longer than 60 days", () => {
    const result = createRoomSchema.safeParse({ ...base, startDate: "2026-01-01", endDate: "2026-04-01" });
    expect(result.success).toBe(false);
  });

  it("accepts a range of exactly 60 days", () => {
    const result = createRoomSchema.safeParse({ ...base, startDate: "2026-01-01", endDate: "2026-03-02" });
    expect(result.success).toBe(true);
  });

  it("rejects an hour outside 0-23/1-24 bounds", () => {
    expect(createRoomSchema.safeParse({ ...base, dayStartHour: -1 }).success).toBe(false);
    expect(createRoomSchema.safeParse({ ...base, dayEndHour: 25 }).success).toBe(false);
  });
});
