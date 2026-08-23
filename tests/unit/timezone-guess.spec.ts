import { describe, expect, it } from "vitest";
import { offsetMinutesToEtcZone, pickGuessedTimezone } from "@/lib/timezone-guess";

describe("offsetMinutesToEtcZone", () => {
  it("maps UTC (offset 0) to UTC", () => {
    expect(offsetMinutesToEtcZone(0)).toBe("UTC");
  });

  it("inverts the sign per POSIX Etc/GMT convention", () => {
    // New York standard time: UTC-5, getTimezoneOffset() returns +300.
    expect(offsetMinutesToEtcZone(300)).toBe("Etc/GMT+5");
    // Prague standard time: UTC+1, getTimezoneOffset() returns -60.
    expect(offsetMinutesToEtcZone(-60)).toBe("Etc/GMT-1");
  });

  it("rounds half/quarter-hour offsets to the nearest whole hour", () => {
    // India: UTC+5:30, getTimezoneOffset() returns -330.
    expect(offsetMinutesToEtcZone(-330)).toBe("Etc/GMT-6");
    // Nepal: UTC+5:45, getTimezoneOffset() returns -345.
    expect(offsetMinutesToEtcZone(-345)).toBe("Etc/GMT-6");
  });

  it("clamps extreme offsets to the Etc/GMT-supported range", () => {
    expect(offsetMinutesToEtcZone(-900)).toBe("Etc/GMT-14");
    expect(offsetMinutesToEtcZone(900)).toBe("Etc/GMT+12");
  });
});

describe("pickGuessedTimezone", () => {
  const supportedZones = new Set(["Europe/Prague", "America/New_York", "UTC", "Etc/GMT+5"]);

  it("prefers a valid Intl zone over every other source", () => {
    const result = pickGuessedTimezone({
      intlZone: "Europe/Prague",
      rememberedZone: "America/New_York",
      offsetMinutes: 300,
      supportedZones,
    });
    expect(result).toBe("Europe/Prague");
  });

  it("falls back to the remembered zone when Intl is unavailable or unsupported", () => {
    const unavailable = pickGuessedTimezone({
      intlZone: null,
      rememberedZone: "America/New_York",
      offsetMinutes: null,
      supportedZones,
    });
    expect(unavailable).toBe("America/New_York");

    const unsupported = pickGuessedTimezone({
      intlZone: "Not/AZone",
      rememberedZone: "America/New_York",
      offsetMinutes: null,
      supportedZones,
    });
    expect(unsupported).toBe("America/New_York");
  });

  it("falls back to an offset-derived zone when Intl and remembered are both unavailable", () => {
    const result = pickGuessedTimezone({
      intlZone: null,
      rememberedZone: null,
      offsetMinutes: 300,
      supportedZones,
    });
    expect(result).toBe("Etc/GMT+5");
  });

  it("falls back to UTC when nothing else resolves to a supported zone", () => {
    const result = pickGuessedTimezone({
      intlZone: null,
      rememberedZone: "Not/Remembered",
      offsetMinutes: 999,
      supportedZones,
    });
    expect(result).toBe("UTC");
  });
});
