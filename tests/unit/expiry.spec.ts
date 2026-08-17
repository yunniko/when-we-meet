import { describe, expect, it } from "vitest";
import { isRoomExpired, roomExpiryDate } from "@/lib/expiry";

describe("roomExpiryDate", () => {
  it("is 3 days after the planning range's end date when nothing was finalized", () => {
    const room = { endDate: new Date("2026-08-21T00:00:00Z"), selectedDate: null };
    expect(roomExpiryDate(room).toISOString()).toBe("2026-08-24T00:00:00.000Z");
  });

  it("is 3 days after the finalized meeting date, not the range end, once one is set", () => {
    const room = {
      endDate: new Date("2026-08-30T00:00:00Z"),
      selectedDate: new Date("2026-08-21T00:00:00Z"),
    };
    expect(roomExpiryDate(room).toISOString()).toBe("2026-08-24T00:00:00.000Z");
  });
});

describe("isRoomExpired", () => {
  const room = { endDate: new Date("2026-08-21T00:00:00Z"), selectedDate: null };

  it("is false right up to the expiry instant", () => {
    expect(isRoomExpired(room, new Date("2026-08-23T23:59:59.999Z"))).toBe(false);
  });

  it("is true at and after the expiry instant", () => {
    expect(isRoomExpired(room, new Date("2026-08-24T00:00:00.000Z"))).toBe(true);
    expect(isRoomExpired(room, new Date("2026-09-01T00:00:00.000Z"))).toBe(true);
  });
});
