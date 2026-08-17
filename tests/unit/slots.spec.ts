import { describe, expect, it } from "vitest";
import {
  dateOnly,
  enumerateDates,
  enumerateHours,
  formatDateRange,
  formatDayLabel,
  formatHour,
  formatHoursWindow,
  slotKey,
  summarizeAvailability,
} from "@/lib/slots";

describe("dateOnly", () => {
  it("extracts YYYY-MM-DD from a UTC-midnight Date", () => {
    expect(dateOnly(new Date("2026-08-21T00:00:00Z"))).toBe("2026-08-21");
  });
});

describe("enumerateDates", () => {
  it("is inclusive of both endpoints", () => {
    const dates = enumerateDates(
      new Date("2026-08-21T00:00:00Z"),
      new Date("2026-08-23T00:00:00Z"),
    );
    expect(dates).toEqual(["2026-08-21", "2026-08-22", "2026-08-23"]);
  });

  it("returns a single date for a single-day room", () => {
    const dates = enumerateDates(
      new Date("2026-09-05T00:00:00Z"),
      new Date("2026-09-05T00:00:00Z"),
    );
    expect(dates).toEqual(["2026-09-05"]);
  });

  it("crosses a month boundary correctly", () => {
    const dates = enumerateDates(
      new Date("2026-01-30T00:00:00Z"),
      new Date("2026-02-01T00:00:00Z"),
    );
    expect(dates).toEqual(["2026-01-30", "2026-01-31", "2026-02-01"]);
  });
});

describe("enumerateHours", () => {
  it("is inclusive of dayStartHour, exclusive of dayEndHour", () => {
    expect(enumerateHours(9, 13)).toEqual([9, 10, 11, 12]);
  });

  it("covers the whole day for 0-24", () => {
    expect(enumerateHours(0, 24)).toHaveLength(24);
    expect(enumerateHours(0, 24)[0]).toBe(0);
    expect(enumerateHours(0, 24).at(-1)).toBe(23);
  });
});

describe("formatHour", () => {
  it("pads single-digit hours", () => {
    expect(formatHour(9)).toBe("09:00");
    expect(formatHour(17)).toBe("17:00");
  });
});

describe("formatHoursWindow", () => {
  it("labels a full 0-24 window as 'Whole day'", () => {
    expect(formatHoursWindow(0, 24)).toBe("Whole day");
  });

  it("formats a custom window", () => {
    expect(formatHoursWindow(9, 17)).toBe("09:00–17:00");
  });
});

describe("formatDateRange", () => {
  it("collapses a single-day range to one date", () => {
    const d = new Date("2026-09-05T00:00:00Z");
    expect(formatDateRange(d, d)).toBe("2026-09-05");
  });

  it("shows both dates for a multi-day range", () => {
    expect(
      formatDateRange(
        new Date("2026-08-21T00:00:00Z"),
        new Date("2026-08-23T00:00:00Z"),
      ),
    ).toBe("2026-08-21 – 2026-08-23");
  });
});

describe("formatDayLabel", () => {
  it("formats a weekday + month + day", () => {
    // 2026-08-21 is a Friday
    expect(formatDayLabel("2026-08-21")).toMatch(/Fri/);
    expect(formatDayLabel("2026-08-21")).toMatch(/Aug/);
    expect(formatDayLabel("2026-08-21")).toMatch(/21/);
  });
});

describe("slotKey", () => {
  it("combines date and hour into a stable key", () => {
    expect(slotKey("2026-08-21", 9)).toBe("2026-08-21T9");
  });
});

describe("summarizeAvailability", () => {
  it("returns zero counts for no rows", () => {
    expect(summarizeAvailability([])).toEqual({
      canCount: 0,
      cannotCount: 0,
      byDate: [],
    });
  });

  it("counts CAN/CANNOT per date and overall, sorted by date", () => {
    const summary = summarizeAvailability([
      { slotDate: new Date("2026-08-22T00:00:00Z"), slotHour: 9, status: "CAN", preferred: false },
      { slotDate: new Date("2026-08-21T00:00:00Z"), slotHour: 9, status: "CAN", preferred: true },
      { slotDate: new Date("2026-08-21T00:00:00Z"), slotHour: 10, status: "CANNOT", preferred: false },
    ]);

    expect(summary.canCount).toBe(2);
    expect(summary.cannotCount).toBe(1);
    expect(summary.byDate).toEqual([
      { date: "2026-08-21", canCount: 1, cannotCount: 1 },
      { date: "2026-08-22", canCount: 1, cannotCount: 0 },
    ]);
  });
});
