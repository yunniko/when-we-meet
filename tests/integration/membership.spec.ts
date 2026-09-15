import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  addInvitedParticipants,
  claimParticipant,
  createRoomWithInvites,
  joinByName,
  leaveRoomAs,
  removeParticipantConfirmed,
  removeUnclaimedParticipant,
  saveMarks,
  setJoinRule,
} from "@/lib/membership";
import { MAX_PARTICIPANTS_PER_ROOM } from "@/lib/validation";
import { splitRoster } from "@/lib/roster";

// lib/membership.ts against the local dev Postgres. Every test builds its
// own rooms and deletes them afterwards (participants and marks cascade).

const createdRooms: string[] = [];

async function makeRoom(joinRule: "ANYONE" | "LISTED_ONLY" = "ANYONE") {
  const room = await prisma.room.create({
    data: {
      slug: `it-${randomUUID()}`,
      timezone: "Europe/London",
      startDate: new Date("2027-10-01T00:00:00Z"),
      endDate: new Date("2027-10-03T00:00:00Z"),
      ownerToken: randomUUID(),
      joinRule,
    },
  });
  createdRooms.push(room.id);
  return room;
}

const at = (minute: number) => new Date(Date.UTC(2027, 0, 1, 12, minute));
let created = 0;

// joinedAt null = an invited name nobody has claimed. createdAt increases
// with every call so creation order is unambiguous.
async function addMember(roomId: string, name: string, joinedAt: Date | null) {
  created++;
  return prisma.participant.create({
    data: {
      roomId,
      name,
      nameKey: name.toLowerCase(),
      cookieToken: randomUUID(),
      joinedAt,
      createdAt: new Date(Date.UTC(2027, 0, 1, 0, 0, created)),
    },
  });
}

async function setOwner(roomId: string, participantId: string) {
  await prisma.room.update({ where: { id: roomId }, data: { creatorParticipantId: participantId } });
}

// The identity a request carries: the participant its cookie resolved to
// and that cookie's token at the time.
const actor = (p: { id: string; cookieToken: string }) => ({
  participantId: p.id,
  cookieToken: p.cookieToken,
});

async function fillRoom(roomId: string, count: number) {
  await prisma.participant.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      roomId,
      name: `Filler ${i}`,
      nameKey: `filler ${i}`,
      cookieToken: randomUUID(),
      joinedAt: i % 2 === 0 ? new Date() : null,
    })),
  });
}

const roomState = (roomId: string) => prisma.room.findUniqueOrThrow({ where: { id: roomId } });

afterEach(async () => {
  await prisma.room.deleteMany({ where: { id: { in: createdRooms.splice(0) } } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("joinByName", () => {
  it("creates a joined participant and makes the creating browser the owner", async () => {
    const room = await makeRoom();
    const res = await joinByName(room.id, "Ada", room.ownerToken);
    const ada = await prisma.participant.findFirstOrThrow({ where: { roomId: room.id } });
    expect(res).toEqual({ kind: "joined", cookieToken: ada.cookieToken });
    expect(ada.joinedAt).not.toBeNull();
    expect((await roomState(room.id)).creatorParticipantId).toBe(ada.id);
  });

  it("gives a never-owned room to nobody when the joiner lacks the owner token", async () => {
    const room = await makeRoom();
    expect((await joinByName(room.id, "Stranger", undefined)).kind).toBe("joined");
    expect((await joinByName(room.id, "Other", "wrong-token")).kind).toBe("joined");
    const state = await roomState(room.id);
    expect(state.creatorParticipantId).toBeNull();
    expect(state.ownershipVacant).toBe(false);
  });

  it("returns the existing participant for a taken or invited name, case-insensitively", async () => {
    const room = await makeRoom();
    const ivy = await addMember(room.id, "Invited Ivy", null);
    expect(await joinByName(room.id, "INVITED IVY", undefined)).toEqual({
      kind: "exists",
      participant: { id: ivy.id, name: "Invited Ivy", joinedAt: null },
    });
    expect(await prisma.participant.count({ where: { roomId: room.id } })).toBe(1);
  });

  it("refuses a new name when joined and invited people together fill the room", async () => {
    const room = await makeRoom();
    await fillRoom(room.id, MAX_PARTICIPANTS_PER_ROOM);
    expect((await joinByName(room.id, "One More", undefined)).kind).toBe("full");
  });

  it("holds the cap when several people join at the same moment", async () => {
    const room = await makeRoom();
    await fillRoom(room.id, MAX_PARTICIPANTS_PER_ROOM - 2);
    const results = await Promise.all(
      ["A", "B", "C", "D", "E"].map((n) => joinByName(room.id, `Late ${n}`, undefined)),
    );
    expect(results.filter((r) => r.kind === "joined")).toHaveLength(2);
    expect(results.filter((r) => r.kind === "full")).toHaveLength(3);
    expect(await prisma.participant.count({ where: { roomId: room.id } })).toBe(
      MAX_PARTICIPANTS_PER_ROOM,
    );
  });

  it("reports a room that no longer exists", async () => {
    expect(await joinByName("no-such-room", "Ada", undefined)).toEqual({ kind: "roomGone" });
  });
});

describe("claimParticipant", () => {
  it("records the first join time of an invited name and keeps it on a later claim", async () => {
    const room = await makeRoom("LISTED_ONLY");
    const ivy = await addMember(room.id, "Ivy", null);

    expect(await claimParticipant(room.id, ivy.id, undefined)).toEqual({
      kind: "claimed",
      cookieToken: ivy.cookieToken,
    });
    const firstJoin = (await prisma.participant.findUniqueOrThrow({ where: { id: ivy.id } })).joinedAt;
    expect(firstJoin).not.toBeNull();

    await claimParticipant(room.id, ivy.id, undefined);
    const again = await prisma.participant.findUniqueOrThrow({ where: { id: ivy.id } });
    expect(again.joinedAt).toEqual(firstJoin);
  });

  it("refuses a participant from a different room", async () => {
    const roomA = await makeRoom();
    const roomB = await makeRoom();
    const inA = await addMember(roomA.id, "Ann", at(0));
    expect(await claimParticipant(roomB.id, inA.id, undefined)).toEqual({ kind: "notFound" });
  });
});

describe("leaveRoomAs", () => {
  it("deletes under 'anyone'; ownership passes to the earliest joined, skipping an older invite", async () => {
    const room = await makeRoom();
    const owner = await addMember(room.id, "Owner", at(0));
    await addMember(room.id, "Early Invite", null);
    await addMember(room.id, "Cy", at(20));
    const bea = await addMember(room.id, "Bea", at(10)); // created after Cy, joined before
    await setOwner(room.id, owner.id);

    expect(await leaveRoomAs(room.id, actor(owner))).toBe("deleted");
    expect(await prisma.participant.findUnique({ where: { id: owner.id } })).toBeNull();
    const state = await roomState(room.id);
    expect(state.creatorParticipantId).toBe(bea.id);
    expect(state.ownershipVacant).toBe(false);
  });

  it("under 'listed only' keeps the name but resets it: unclaimed, marks gone, new token", async () => {
    const room = await makeRoom("LISTED_ONLY");
    const ann = await addMember(room.id, "Ann", at(0));
    await prisma.availability.create({
      data: { participantId: ann.id, slotDate: new Date("2027-10-01T00:00:00Z"), slotHour: 9, status: "CAN" },
    });

    expect(await leaveRoomAs(room.id, actor(ann))).toBe("reset");
    const after = await prisma.participant.findUniqueOrThrow({ where: { id: ann.id } });
    expect(after.joinedAt).toBeNull();
    expect(after.cookieToken).not.toBe(ann.cookieToken);
    expect(await prisma.availability.count({ where: { participantId: ann.id } })).toBe(0);
  });

  it("leaves the room vacant when only invites remain, and the next claim takes ownership", async () => {
    const room = await makeRoom("LISTED_ONLY");
    const owner = await addMember(room.id, "Owner", at(0));
    const ivy = await addMember(room.id, "Ivy", null);
    await setOwner(room.id, owner.id);

    expect(await leaveRoomAs(room.id, actor(owner))).toBe("reset");
    let state = await roomState(room.id);
    expect(state.creatorParticipantId).toBeNull();
    expect(state.ownershipVacant).toBe(true);

    await claimParticipant(room.id, ivy.id, undefined);
    state = await roomState(room.id);
    expect(state.creatorParticipantId).toBe(ivy.id);
    expect(state.ownershipVacant).toBe(false);
  });

  it("reports a participant who isn't in the room", async () => {
    const room = await makeRoom();
    expect(await leaveRoomAs(room.id, { participantId: "no-such-participant", cookieToken: "none" })).toBe("notFound");
  });
});

describe("removal", () => {
  it("removes an unclaimed invite without confirmation, but not a claimed name or for a non-owner", async () => {
    const room = await makeRoom();
    const owner = await addMember(room.id, "Owner", at(0));
    const ivy = await addMember(room.id, "Ivy", null);
    const joe = await addMember(room.id, "Joe", at(5));
    await setOwner(room.id, owner.id);

    expect(await removeUnclaimedParticipant(room.id, actor(joe), ivy.id)).toEqual({ ok: false, error: "notOwner" });
    expect(await removeUnclaimedParticipant(room.id, actor(owner), joe.id)).toEqual({ ok: false, error: "claimed" });
    expect(await removeUnclaimedParticipant(room.id, actor(owner), ivy.id)).toEqual({ ok: true });
    expect(await removeUnclaimedParticipant(room.id, actor(owner), ivy.id)).toEqual({ ok: false, error: "notFound" });
    expect(await prisma.participant.findUnique({ where: { id: joe.id } })).not.toBeNull();
  });

  it("confirmed removal checks ownership, self, name and room", async () => {
    const room = await makeRoom();
    const owner = await addMember(room.id, "Owner", at(0));
    const bea = await addMember(room.id, "Bea", at(5));
    await setOwner(room.id, owner.id);
    await prisma.availability.create({
      data: { participantId: bea.id, slotDate: new Date("2027-10-01T00:00:00Z"), slotHour: 9, status: "CAN" },
    });

    expect(await removeParticipantConfirmed(room.id, actor(owner), owner.id, "Owner")).toEqual({ ok: false, error: "self" });
    expect(await removeParticipantConfirmed(room.id, actor(owner), bea.id, "Be")).toEqual({ ok: false, error: "nameMismatch" });
    expect(await removeParticipantConfirmed(room.id, actor(bea), owner.id, "Owner")).toEqual({ ok: false, error: "notOwner" });
    expect(await removeParticipantConfirmed("no-such-room", actor(owner), bea.id, "Bea")).toEqual({ ok: false, error: "roomGone" });
    expect(await removeParticipantConfirmed(room.id, actor(owner), bea.id, " bea ")).toEqual({ ok: true });
    expect(await prisma.participant.findUnique({ where: { id: bea.id } })).toBeNull();
    expect(await prisma.availability.count({ where: { participantId: bea.id } })).toBe(0);
  });

  it("an owner leaving while removing their heir never leaves the room without a live owner", async () => {
    for (let round = 0; round < 6; round++) {
      const room = await makeRoom();
      const owner = await addMember(room.id, "Owner", at(0));
      const heir = await addMember(room.id, "Heir", at(1));
      const next = await addMember(room.id, "Next", at(2));
      await setOwner(room.id, owner.id);

      const [, removal] = await Promise.all([
        leaveRoomAs(room.id, actor(owner)),
        removeParticipantConfirmed(room.id, actor(owner), heir.id, "Heir"),
      ]);

      const state = await roomState(room.id);
      expect(state.creatorParticipantId).not.toBeNull();
      expect(
        await prisma.participant.findUnique({ where: { id: state.creatorParticipantId! } }),
      ).not.toBeNull();
      if (removal.ok) {
        expect(state.creatorParticipantId).toBe(next.id); // removal won the lock first
      } else {
        expect(removal).toEqual({ ok: false, error: "notOwner" }); // leave won: heir owns
        expect(state.creatorParticipantId).toBe(heir.id);
      }
    }
  });
});

describe("stale requests after a reset (D012)", () => {
  it("a leave resolved before a reset can't evict whoever reclaimed the name", async () => {
    const room = await makeRoom("LISTED_ONLY");
    const owner = await addMember(room.id, "Owner", at(0));
    await setOwner(room.id, owner.id);
    const stale = actor(owner);

    expect(await leaveRoomAs(room.id, stale)).toBe("reset");
    await claimParticipant(room.id, owner.id, undefined); // reclaimed; the vacant room is theirs again
    expect((await roomState(room.id)).creatorParticipantId).toBe(owner.id);

    expect(await leaveRoomAs(room.id, stale)).toBe("notFound");
    expect((await roomState(room.id)).creatorParticipantId).toBe(owner.id);
    const row = await prisma.participant.findUniqueOrThrow({ where: { id: owner.id } });
    expect(row.joinedAt).not.toBeNull();
  });

  it("removals resolved before the owner's reset are refused once the name is reclaimed", async () => {
    const room = await makeRoom("LISTED_ONLY");
    const owner = await addMember(room.id, "Owner", at(0));
    const bea = await addMember(room.id, "Bea", null);
    await setOwner(room.id, owner.id);
    const stale = actor(owner);

    await leaveRoomAs(room.id, stale);
    await claimParticipant(room.id, owner.id, undefined);

    expect(await removeParticipantConfirmed(room.id, stale, bea.id, "Bea")).toEqual({ ok: false, error: "notOwner" });
    expect(await removeUnclaimedParticipant(room.id, stale, bea.id)).toEqual({ ok: false, error: "notOwner" });
    expect(await prisma.participant.findUnique({ where: { id: bea.id } })).not.toBeNull();
  });
});

describe("saveMarks", () => {
  const day = new Date("2027-10-01T00:00:00Z");
  const marksOf = (participantId: string) =>
    prisma.availability.findMany({
      where: { participantId },
      orderBy: { slotHour: "asc" },
      select: { slotHour: true, status: true, preferred: true },
    });

  it("sets, overwrites and clears marks; the last write for a slot wins; preferred sticks only to CAN", async () => {
    const room = await makeRoom();
    const ann = await addMember(room.id, "Ann", at(0));

    expect(
      await saveMarks(room.id, actor(ann), [
        { slotDate: day, slotHour: 9, status: "CAN", preferred: true },
        { slotDate: day, slotHour: 10, status: "CANNOT", preferred: true },
        { slotDate: day, slotHour: 11, status: "CAN", preferred: false },
        { slotDate: day, slotHour: 11, status: "CANNOT", preferred: false },
      ]),
    ).toBe("saved");
    expect(await marksOf(ann.id)).toEqual([
      { slotHour: 9, status: "CAN", preferred: true },
      { slotHour: 10, status: "CANNOT", preferred: false },
      { slotHour: 11, status: "CANNOT", preferred: false },
    ]);

    expect(
      await saveMarks(room.id, actor(ann), [
        { slotDate: day, slotHour: 9, status: null, preferred: false },
        { slotDate: day, slotHour: 10, status: "CAN", preferred: false },
      ]),
    ).toBe("saved");
    expect(await marksOf(ann.id)).toEqual([
      { slotHour: 10, status: "CAN", preferred: false },
      { slotHour: 11, status: "CANNOT", preferred: false },
    ]);
  });

  it("refuses a token rotated by a reset and writes nothing", async () => {
    const room = await makeRoom("LISTED_ONLY");
    const ann = await addMember(room.id, "Ann", at(0));
    const stale = actor(ann);
    await leaveRoomAs(room.id, stale);

    expect(
      await saveMarks(room.id, stale, [{ slotDate: day, slotHour: 9, status: "CAN", preferred: false }]),
    ).toBe("removed");
    expect(await prisma.availability.count({ where: { participantId: ann.id } })).toBe(0);
  });

  it("a save racing a reset never leaves marks on the unclaimed name", async () => {
    // Timing-dependent by nature (D012), so many rounds, alternating which
    // request starts first and staggering the other by 0-5 ms to reach the
    // interleavings where the save's identity check lands before the reset.
    const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    for (let round = 0; round < 60; round++) {
      const room = await makeRoom("LISTED_ONLY");
      const ann = await addMember(room.id, "Ann", at(0));
      const save = () =>
        saveMarks(room.id, actor(ann), [{ slotDate: day, slotHour: 9, status: "CAN", preferred: false }]);
      const leave = () => leaveRoomAs(room.id, actor(ann));
      const stagger = round % 6;
      const [saved] =
        round % 2 === 0
          ? await Promise.all([save(), pause(stagger).then(leave)])
          : await Promise.all([pause(stagger).then(save), leave()]);
      expect(["saved", "removed"]).toContain(saved);
      expect(await prisma.availability.count({ where: { participantId: ann.id } })).toBe(0);
    }
  });
});

describe("createRoomWithInvites", () => {
  const roomData = () => ({
    slug: `it-${randomUUID()}`,
    timezone: "Europe/London",
    startDate: new Date("2027-10-01T00:00:00Z"),
    endDate: new Date("2027-10-03T00:00:00Z"),
    ownerToken: randomUUID(),
    joinRule: "LISTED_ONLY" as const,
  });

  it("creates the room with its invited names, unclaimed and in the order typed", async () => {
    const room = await createRoomWithInvites(roomData(), ["Zoe", "Adam", "Mia"]);
    createdRooms.push(room.id);
    const rows = await prisma.participant.findMany({
      where: { roomId: room.id },
      select: { id: true, name: true, joinedAt: true, createdAt: true, cookieToken: true },
    });
    const { joined, invited } = splitRoster(rows);
    expect(joined).toHaveLength(0);
    expect(invited.map((r) => r.name)).toEqual(["Zoe", "Adam", "Mia"]);
    expect(new Set(rows.map((r) => r.cookieToken)).size).toBe(3);
  });

  it("creates neither the room nor any name when one name breaks a constraint", async () => {
    const data = roomData();
    await expect(createRoomWithInvites(data, ["Same", "same"])).rejects.toThrow();
    expect(await prisma.room.findUnique({ where: { slug: data.slug } })).toBeNull();
  });
});

describe("join rule", () => {
  it("under 'listed names only' refuses new names except from the creating browser", async () => {
    const room = await makeRoom("LISTED_ONLY");
    await addMember(room.id, "Ivy", null);

    expect(await joinByName(room.id, "Mallory", undefined)).toEqual({ kind: "notOnList" });
    expect(await joinByName(room.id, "Mallory", "wrong-token")).toEqual({ kind: "notOnList" });
    expect((await joinByName(room.id, "ivy", undefined)).kind).toBe("exists");
    expect((await joinByName(room.id, "Organizer", room.ownerToken)).kind).toBe("joined");
    expect(await prisma.participant.count({ where: { roomId: room.id } })).toBe(2);
    expect((await roomState(room.id)).creatorParticipantId).not.toBeNull();
  });
});

describe("owner list editing (G-004 M3)", () => {
  it("adds new names as unclaimed, skipping names already in the room", async () => {
    const room = await makeRoom();
    const owner = await addMember(room.id, "Owner", at(0));
    await addMember(room.id, "Bea", at(1));
    await setOwner(room.id, owner.id);

    expect(await addInvitedParticipants(room.id, actor(owner), ["Cy", "bea", "Dee"])).toEqual({
      ok: true,
      added: ["Cy", "Dee"],
      skipped: ["Bea"],
    });
    const rows = await prisma.participant.findMany({
      where: { roomId: room.id },
      select: { id: true, name: true, joinedAt: true, createdAt: true },
    });
    expect(splitRoster(rows).invited.map((r) => r.name)).toEqual(["Cy", "Dee"]);
  });

  it("adds nothing when the new names would take the room past its cap", async () => {
    const room = await makeRoom();
    const owner = await addMember(room.id, "Owner", at(0));
    await setOwner(room.id, owner.id);
    await fillRoom(room.id, MAX_PARTICIPANTS_PER_ROOM - 2); // 99 with the owner

    expect(await addInvitedParticipants(room.id, actor(owner), ["A", "B"])).toEqual({ ok: false, error: "full" });
    expect(await prisma.participant.count({ where: { roomId: room.id } })).toBe(MAX_PARTICIPANTS_PER_ROOM - 1);
    expect(await addInvitedParticipants(room.id, actor(owner), ["A"])).toMatchObject({ ok: true, added: ["A"] });
  });

  it("refuses a non-owner and an owner whose cookie token is stale", async () => {
    const room = await makeRoom();
    const owner = await addMember(room.id, "Owner", at(0));
    const joe = await addMember(room.id, "Joe", at(1));
    await setOwner(room.id, owner.id);
    const stale = { participantId: owner.id, cookieToken: "old-token" };

    expect(await addInvitedParticipants(room.id, actor(joe), ["X"])).toEqual({ ok: false, error: "notOwner" });
    expect(await addInvitedParticipants(room.id, stale, ["X"])).toEqual({ ok: false, error: "notOwner" });
    expect(await setJoinRule(room.id, actor(joe), "LISTED_ONLY")).toEqual({ ok: false, error: "notOwner" });
    expect(await setJoinRule(room.id, stale, "LISTED_ONLY")).toEqual({ ok: false, error: "notOwner" });
    expect((await roomState(room.id)).joinRule).toBe("ANYONE");
    expect(await prisma.participant.count({ where: { roomId: room.id } })).toBe(2);
  });

  it("switches the join rule for the owner, and joining follows it", async () => {
    const room = await makeRoom();
    const owner = await addMember(room.id, "Owner", at(0));
    await setOwner(room.id, owner.id);

    expect(await setJoinRule(room.id, actor(owner), "LISTED_ONLY")).toEqual({ ok: true });
    expect((await roomState(room.id)).joinRule).toBe("LISTED_ONLY");
    expect(await joinByName(room.id, "Stranger", undefined)).toEqual({ kind: "notOnList" });
  });

  it("marks a listed-only leave as left, and clears it when the name is claimed again (D013)", async () => {
    const room = await makeRoom("LISTED_ONLY");
    const ann = await addMember(room.id, "Ann", at(0));
    const never = await addMember(room.id, "Never", null);

    await leaveRoomAs(room.id, actor(ann));
    expect((await prisma.participant.findUniqueOrThrow({ where: { id: ann.id } })).leftAt).not.toBeNull();
    expect((await prisma.participant.findUniqueOrThrow({ where: { id: never.id } })).leftAt).toBeNull();

    await claimParticipant(room.id, ann.id, undefined);
    const again = await prisma.participant.findUniqueOrThrow({ where: { id: ann.id } });
    expect(again.leftAt).toBeNull();
    expect(again.joinedAt).not.toBeNull();
  });
});

describe("leave with a changed join rule (G-004 M3)", () => {
  it("refuses a leave whose confirmation described a rule the owner has since changed", async () => {
    const room = await makeRoom("ANYONE");
    const owner = await addMember(room.id, "Owner", at(0));
    const ann = await addMember(room.id, "Ann", at(1));
    await setOwner(room.id, owner.id);
    await setJoinRule(room.id, actor(owner), "LISTED_ONLY");

    expect(await leaveRoomAs(room.id, actor(ann), "ANYONE")).toBe("ruleChanged");
    const untouched = await prisma.participant.findUniqueOrThrow({ where: { id: ann.id } });
    expect(untouched.cookieToken).toBe(ann.cookieToken);
    expect(untouched.joinedAt).not.toBeNull();

    expect(await leaveRoomAs(room.id, actor(ann), "LISTED_ONLY")).toBe("reset");
  });
});
