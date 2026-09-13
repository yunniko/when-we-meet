import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  claimParticipant,
  joinByName,
  leaveRoomAs,
  removeParticipantConfirmed,
  removeUnclaimedParticipant,
} from "@/lib/membership";
import { MAX_PARTICIPANTS_PER_ROOM } from "@/lib/validation";

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
      participant: { id: ivy.id, name: "Invited Ivy" },
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

    expect(await leaveRoomAs(room.id, owner.id)).toBe("deleted");
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

    expect(await leaveRoomAs(room.id, ann.id)).toBe("reset");
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

    expect(await leaveRoomAs(room.id, owner.id)).toBe("reset");
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
    expect(await leaveRoomAs(room.id, "no-such-participant")).toBe("notFound");
  });
});

describe("removal", () => {
  it("removes an unclaimed invite without confirmation, but not a claimed name or for a non-owner", async () => {
    const room = await makeRoom();
    const owner = await addMember(room.id, "Owner", at(0));
    const ivy = await addMember(room.id, "Ivy", null);
    const joe = await addMember(room.id, "Joe", at(5));
    await setOwner(room.id, owner.id);

    expect(await removeUnclaimedParticipant(room.id, joe.id, ivy.id)).toEqual({ ok: false, error: "notOwner" });
    expect(await removeUnclaimedParticipant(room.id, owner.id, joe.id)).toEqual({ ok: false, error: "claimed" });
    expect(await removeUnclaimedParticipant(room.id, owner.id, ivy.id)).toEqual({ ok: true });
    expect(await removeUnclaimedParticipant(room.id, owner.id, ivy.id)).toEqual({ ok: false, error: "notFound" });
    expect(await prisma.participant.findUnique({ where: { id: joe.id } })).not.toBeNull();
  });

  it("confirmed removal checks ownership, self, name and room", async () => {
    const room = await makeRoom();
    const owner = await addMember(room.id, "Owner", at(0));
    const bea = await addMember(room.id, "Bea", at(5));
    await setOwner(room.id, owner.id);

    expect(await removeParticipantConfirmed(room.id, owner.id, owner.id, "Owner")).toEqual({ ok: false, error: "self" });
    expect(await removeParticipantConfirmed(room.id, owner.id, bea.id, "Be")).toEqual({ ok: false, error: "nameMismatch" });
    expect(await removeParticipantConfirmed(room.id, bea.id, owner.id, "Owner")).toEqual({ ok: false, error: "notOwner" });
    expect(await removeParticipantConfirmed("no-such-room", owner.id, bea.id, "Bea")).toEqual({ ok: false, error: "roomGone" });
    expect(await removeParticipantConfirmed(room.id, owner.id, bea.id, " bea ")).toEqual({ ok: true });
  });

  it("an owner leaving while removing their heir never leaves the room without a live owner", async () => {
    for (let round = 0; round < 6; round++) {
      const room = await makeRoom();
      const owner = await addMember(room.id, "Owner", at(0));
      const heir = await addMember(room.id, "Heir", at(1));
      const next = await addMember(room.id, "Next", at(2));
      await setOwner(room.id, owner.id);

      const [, removal] = await Promise.all([
        leaveRoomAs(room.id, owner.id),
        removeParticipantConfirmed(room.id, owner.id, heir.id, "Heir"),
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
