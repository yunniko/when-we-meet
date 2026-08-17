import { describe, expect, it } from "vitest";
import { DAILY_PRESETS, isPresetKey } from "@/lib/room-presets";

describe("isPresetKey", () => {
  it("accepts every known preset plus custom", () => {
    expect(isPresetKey("custom")).toBe(true);
    for (const key of Object.keys(DAILY_PRESETS)) {
      expect(isPresetKey(key)).toBe(true);
    }
  });

  it("rejects unknown values", () => {
    expect(isPresetKey("afternoon")).toBe(false);
    expect(isPresetKey("")).toBe(false);
  });
});

describe("DAILY_PRESETS", () => {
  it("every preset has a valid, non-empty hour range", () => {
    for (const { start, end } of Object.values(DAILY_PRESETS)) {
      expect(start).toBeGreaterThanOrEqual(0);
      expect(end).toBeLessThanOrEqual(24);
      expect(end).toBeGreaterThan(start);
    }
  });
});
