import { describe, expect, it } from "vitest";
import { computeResults } from "@/lib/results";
import type { AvailabilityRow } from "@/lib/slots";

const dates = ["2026-08-21", "2026-08-22"];
const hours = [9, 10];

function row(
  date: string,
  hour: number,
  participantName: string,
  status: "CAN" | "CANNOT",
  preferred = false,
): AvailabilityRow & { participantName: string } {
  return {
    slotDate: new Date(`${date}T00:00:00Z`),
    slotHour: hour,
    status,
    preferred,
    participantName,
  };
}

describe("computeResults", () => {
  it("includes every slot in the grid, even ones nobody marked", () => {
    const results = computeResults(dates, hours, ["Alice", "Bob"], []);
    expect(results).toHaveLength(dates.length * hours.length);
    for (const r of results) {
      expect(r).toMatchObject({ canCount: 0, cannotCount: 0, preferredCount: 0, isFullGroup: false });
      expect(r.missingNames).toEqual(["Alice", "Bob"]);
    }
  });

  it("counts CAN/CANNOT/preferred per slot across participants", () => {
    const rows = [
      row("2026-08-21", 9, "Alice", "CAN", true),
      row("2026-08-21", 9, "Bob", "CAN", false),
      row("2026-08-21", 9, "Carol", "CANNOT"),
    ];
    const results = computeResults(dates, hours, ["Alice", "Bob", "Carol"], rows);
    const slot = results.find((r) => r.date === "2026-08-21" && r.hour === 9)!;
    expect(slot.canCount).toBe(2);
    expect(slot.cannotCount).toBe(1);
    expect(slot.preferredCount).toBe(1);
  });

  it("marks a slot as full-group only when everyone marked CAN", () => {
    const rows = [row("2026-08-21", 9, "Alice", "CAN"), row("2026-08-21", 9, "Bob", "CAN")];
    const results = computeResults(dates, hours, ["Alice", "Bob"], rows);
    const full = results.find((r) => r.date === "2026-08-21" && r.hour === 9)!;
    const empty = results.find((r) => r.date === "2026-08-21" && r.hour === 10)!;
    expect(full.isFullGroup).toBe(true);
    expect(empty.isFullGroup).toBe(false);
  });

  it("never marks full-group with zero participants", () => {
    const results = computeResults(dates, hours, [], []);
    expect(results.every((r) => !r.isFullGroup)).toBe(true);
  });

  it("lists everyone who did NOT mark CAN (explicit CANNOT or unmarked) as missing", () => {
    const rows = [
      row("2026-08-21", 9, "Alice", "CAN"),
      row("2026-08-21", 9, "Bob", "CANNOT"),
      // Carol never marked this slot at all.
    ];
    const results = computeResults(dates, hours, ["Alice", "Bob", "Carol"], rows);
    const slot = results.find((r) => r.date === "2026-08-21" && r.hour === 9)!;
    expect(slot.missingNames).toEqual(["Bob", "Carol"]);
  });

  it("ranks by canCount desc, then preferredCount desc, then chronologically", () => {
    const rows = [
      // 2026-08-21 09:00 -> 1 can, 0 preferred
      row("2026-08-21", 9, "Alice", "CAN"),
      // 2026-08-21 10:00 -> 2 can, 1 preferred
      row("2026-08-21", 10, "Alice", "CAN", true),
      row("2026-08-21", 10, "Bob", "CAN"),
      // 2026-08-22 09:00 -> 2 can, 0 preferred
      row("2026-08-22", 9, "Alice", "CAN"),
      row("2026-08-22", 9, "Bob", "CAN"),
      // 2026-08-22 10:00 -> 2 can, 2 preferred
      row("2026-08-22", 10, "Alice", "CAN", true),
      row("2026-08-22", 10, "Bob", "CAN", true),
    ];
    const results = computeResults(dates, hours, ["Alice", "Bob"], rows);
    const order = results.map((r) => `${r.date}T${r.hour}`);
    expect(order).toEqual([
      "2026-08-22T10", // 2 can, 2 preferred
      "2026-08-21T10", // 2 can, 1 preferred
      "2026-08-22T9", // 2 can, 0 preferred
      "2026-08-21T9", // 1 can
    ]);
  });
});
