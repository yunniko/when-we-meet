import { describe, expect, it } from "vitest";
import { createRoomSchema, MAX_INVITED_NAMES, parseInvitedNames } from "@/lib/validation";

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

describe("parseInvitedNames", () => {
  it("trims, skips blank lines and handles Windows line endings", () => {
    expect(parseInvitedNames("  Anna \r\n\r\n Boris\n\n")).toEqual({ ok: true, names: ["Anna", "Boris"] });
  });

  it("drops case-insensitive duplicates, keeping the first spelling", () => {
    expect(parseInvitedNames("Anna K\nanna k\nANNA K\nBoris")).toEqual({
      ok: true,
      names: ["Anna K", "Boris"],
    });
  });

  it("returns an empty list for an empty box", () => {
    expect(parseInvitedNames("")).toEqual({ ok: true, names: [] });
  });

  it("accepts a 60-character name and rejects a 61-character one", () => {
    expect(parseInvitedNames("x".repeat(60))).toEqual({ ok: true, names: ["x".repeat(60)] });
    expect(parseInvitedNames(`Ok\n${"x".repeat(61)}`)).toEqual({ ok: false, error: "invitedNameTooLong" });
  });

  it("allows up to 99 distinct names, leaving the creator a place", () => {
    const names = (n: number) => Array.from({ length: n }, (_, i) => `Person ${i}`).join("\n");
    expect(MAX_INVITED_NAMES).toBe(99);
    const ok = parseInvitedNames(names(99));
    expect(ok.ok && ok.names.length).toBe(99);
    expect(parseInvitedNames(names(100))).toEqual({ ok: false, error: "tooManyInvitedNames" });
    // Duplicates don't count towards the limit.
    expect(parseInvitedNames(`${names(99)}\nperson 0`).ok).toBe(true);
  });
});

describe("createRoomSchema invited names and join rule", () => {
  it("defaults to 'anyone can join' with no invited names", () => {
    const result = createRoomSchema.safeParse(base);
    expect(result.success && result.data.joinRule).toBe("ANYONE");
    expect(result.success && result.data.invitedNames).toEqual([]);
  });

  it("parses the invited box into a clean list", () => {
    const result = createRoomSchema.safeParse({
      ...base,
      invitedNames: "Anna\nanna\n Boris ",
      joinRule: "LISTED_ONLY",
    });
    expect(result.success && result.data.invitedNames).toEqual(["Anna", "Boris"]);
  });

  it("reports invited-name errors on the invitedNames field", () => {
    const result = createRoomSchema.safeParse({ ...base, invitedNames: "x".repeat(61) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]).toMatchObject({ path: ["invitedNames"], message: "invitedNameTooLong" });
    }
  });

  it("requires at least one invited name for a listed-only room", () => {
    const result = createRoomSchema.safeParse({ ...base, joinRule: "LISTED_ONLY", invitedNames: "\n \n" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]).toMatchObject({ path: ["joinRule"], message: "listedOnlyNeedsNames" });
    }
  });

  it("rejects an unknown join rule", () => {
    expect(createRoomSchema.safeParse({ ...base, joinRule: "EVERYONE" }).success).toBe(false);
  });
});

describe("createRoomSchema invited box size", () => {
  it("accepts a full list of 60-character names pasted twice, since limits apply after deduplication", () => {
    const list = Array.from({ length: 99 }, (_, i) => `${String(i).padStart(2, "0")}${"n".repeat(58)}`).join("\n");
    const result = createRoomSchema.safeParse({ ...base, invitedNames: `${list}\n${list}` });
    expect(result.success && result.data.invitedNames.length).toBe(99);
  });
});
