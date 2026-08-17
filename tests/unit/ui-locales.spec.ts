import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  enabledUiLocales,
  isUiLocale,
  localeDisplayName,
  mergeMessages,
} from "@/lib/ui-locales";

describe("enabledUiLocales", () => {
  it("is the fixed four-language set, English first", () => {
    expect(enabledUiLocales()).toEqual(["en", "ru", "cs", "de"]);
    expect(DEFAULT_LOCALE).toBe("en");
  });
});

describe("isUiLocale", () => {
  it("accepts every enabled locale", () => {
    for (const code of enabledUiLocales()) {
      expect(isUiLocale(code)).toBe(true);
    }
  });

  it("rejects anything else", () => {
    expect(isUiLocale("fr")).toBe(false);
    expect(isUiLocale("")).toBe(false);
    expect(isUiLocale("EN")).toBe(false);
  });
});

describe("localeDisplayName", () => {
  it("uses the native language name", () => {
    expect(localeDisplayName("en")).toBe("English");
    expect(localeDisplayName("ru")).toBe("Русский");
    expect(localeDisplayName("cs")).toBe("Čeština");
    expect(localeDisplayName("de")).toBe("Deutsch");
  });
});

describe("mergeMessages", () => {
  it("overlays translated keys and keeps English for the rest", () => {
    const base = { A: { x: "one", y: "two" }, B: { z: "three" } };
    const overlay = { A: { x: "jedna" } };
    expect(mergeMessages(base, overlay)).toEqual({
      A: { x: "jedna", y: "two" },
      B: { z: "three" },
    });
  });

  it("does not mutate the base", () => {
    const base = { A: { x: "one" } };
    mergeMessages(base, { A: { x: "uno" } });
    expect(base.A.x).toBe("one");
  });
});
