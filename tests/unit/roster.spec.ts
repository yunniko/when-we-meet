import { describe, expect, it } from "vitest";
import { confirmationMatches, nameKeyOf } from "@/lib/roster";

describe("nameKeyOf", () => {
  it("trims and lowercases", () => {
    expect(nameKeyOf("  Anna K  ")).toBe("anna k");
  });

  it("lowercases non-Latin letters too", () => {
    expect(nameKeyOf("Таня")).toBe("таня");
    expect(nameKeyOf("Zdeněk")).toBe("zdeněk");
  });

  it("keeps internal whitespace as typed", () => {
    expect(nameKeyOf("Anna  K")).toBe("anna  k");
  });
});

describe("confirmationMatches", () => {
  it("accepts the exact name", () => {
    expect(confirmationMatches("Anna K", "Anna K")).toBe(true);
  });

  it("ignores case and surrounding whitespace", () => {
    expect(confirmationMatches("  anna k ", "Anna K")).toBe(true);
    expect(confirmationMatches("ANNA K", "Anna K")).toBe(true);
  });

  it("rejects a partial, a different, or a differently spaced name", () => {
    expect(confirmationMatches("Anna", "Anna K")).toBe(false);
    expect(confirmationMatches("Anna K.", "Anna K")).toBe(false);
    expect(confirmationMatches("Anna  K", "Anna K")).toBe(false);
    expect(confirmationMatches("Bob", "Anna K")).toBe(false);
  });

  it("never matches on empty or whitespace-only input", () => {
    expect(confirmationMatches("", "Anna K")).toBe(false);
    expect(confirmationMatches("   ", "Anna K")).toBe(false);
    expect(confirmationMatches("", "")).toBe(false);
  });
});
