import { describe, expect, it } from "vitest";
import {
  confirmationMatches,
  leaveEffect,
  mayAddNewName,
  nameKeyOf,
  pickSuccessor,
  shouldBecomeOwner,
  splitRoster,
} from "@/lib/roster";

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

const at = (minute: number) => new Date(Date.UTC(2027, 0, 1, 12, minute));

function member(id: string, joinedMinute: number | null, createdMinute: number) {
  return {
    id,
    joinedAt: joinedMinute === null ? null : at(joinedMinute),
    createdAt: at(createdMinute),
  };
}

describe("leaveEffect", () => {
  it("deletes under 'anyone can join' and resets under 'listed names only'", () => {
    expect(leaveEffect("ANYONE")).toBe("delete");
    expect(leaveEffect("LISTED_ONLY")).toBe("reset");
  });
});

describe("pickSuccessor", () => {
  it("picks the earliest joined participant, not the earliest created", () => {
    const members = [member("owner", 0, 0), member("late-joiner", 30, 1), member("early-joiner", 10, 2)];
    expect(pickSuccessor(members, "owner")?.id).toBe("early-joiner");
  });

  it("never picks an unclaimed invited name or the person leaving", () => {
    expect(pickSuccessor([member("owner", 0, 0), member("invite", null, 1)], "owner")).toBeNull();
    expect(pickSuccessor([member("owner", 0, 0)], "owner")).toBeNull();
  });

  it("breaks equal join times by creation order, then by id", () => {
    const byCreation = [member("owner", 0, 0), member("b", 5, 3), member("a", 5, 2)];
    expect(pickSuccessor(byCreation, "owner")?.id).toBe("a");
    const byId = [member("owner", 0, 0), member("b", 5, 2), member("a", 5, 2)];
    expect(pickSuccessor(byId, "owner")?.id).toBe("a");
  });
});

describe("shouldBecomeOwner", () => {
  const unowned = { creatorParticipantId: null, ownershipVacant: false, ownerToken: "tok" };

  it("tags only the creating browser in a room nobody has owned yet", () => {
    expect(shouldBecomeOwner(unowned, "tok")).toBe(true);
    expect(shouldBecomeOwner(unowned, "other")).toBe(false);
    expect(shouldBecomeOwner(unowned, undefined)).toBe(false);
  });

  it("hands a vacant room to whoever joins next", () => {
    expect(shouldBecomeOwner({ ...unowned, ownershipVacant: true }, undefined)).toBe(true);
  });

  it("never replaces an existing owner", () => {
    expect(shouldBecomeOwner({ ...unowned, creatorParticipantId: "p1" }, "tok")).toBe(false);
    expect(
      shouldBecomeOwner({ ...unowned, creatorParticipantId: "p1", ownershipVacant: true }, undefined),
    ).toBe(false);
  });
});

describe("splitRoster", () => {
  it("separates joined people, in join order, from invited names, in the order added", () => {
    const { joined, invited } = splitRoster([
      member("j2", 20, 0),
      member("i2", null, 5),
      member("j1", 10, 1),
      member("i1", null, 3),
    ]);
    expect(joined.map((m) => m.id)).toEqual(["j1", "j2"]);
    expect(invited.map((m) => m.id)).toEqual(["i1", "i2"]);
  });
});

describe("mayAddNewName", () => {
  const room = (joinRule: "ANYONE" | "LISTED_ONLY") => ({ joinRule, ownerToken: "tok" });

  it("lets anyone add a name when anyone with the link can join", () => {
    expect(mayAddNewName(room("ANYONE"), undefined)).toBe(true);
  });

  it("under 'listed names only' lets only the creating browser add a name", () => {
    expect(mayAddNewName(room("LISTED_ONLY"), "tok")).toBe(true);
    expect(mayAddNewName(room("LISTED_ONLY"), "other")).toBe(false);
    expect(mayAddNewName(room("LISTED_ONLY"), undefined)).toBe(false);
  });
});
