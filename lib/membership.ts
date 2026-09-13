import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { generateCookieToken } from "@/lib/slug";
import { MAX_PARTICIPANTS_PER_ROOM } from "@/lib/validation";
import {
  confirmationMatches,
  leaveEffect,
  nameKeyOf,
  pickSuccessor,
  shouldBecomeOwner,
} from "@/lib/roster";

// Every write that changes who is in a room or who owns it lives here, and
// each one runs in a transaction holding the room's row lock (D010), so
// joins, claims, leaves and removals see each other's results instead of
// racing. The decisions themselves are pure functions in lib/roster.ts.
// Invited names are participant rows with joinedAt null (D011). A request
// acts as a participant only while its cookie token still matches, checked
// inside the write (D012). Callers pass identity in; nothing here reads
// cookies. tests/integration/membership.spec.ts runs this module against
// Postgres.

type Tx = Prisma.TransactionClient;

// The acting browser: the participant its cookie resolved to, and that
// cookie's token.
export type Actor = { participantId: string; cookieToken: string };

// Locks the room row for the rest of the transaction. False when the room
// no longer exists.
export async function lockRoomRow(tx: Tx, roomId: string): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Room" WHERE "id" = ${roomId} FOR UPDATE`;
  return rows.length > 0;
}

// Re-reads the acting participant inside the transaction, matching the
// cookie token as well as the id. A reset keeps the id but rotates the
// token, so a request that resolved its cookie before a reset (and before
// someone reclaimed the name) matches nothing instead of acting as the new
// holder (D012).
function findActor(tx: Tx, roomId: string, actor: Actor) {
  return tx.participant.findFirst({
    where: { id: actor.participantId, roomId, cookieToken: actor.cookieToken },
  });
}

async function assignOwnerIfEligible(
  tx: Tx,
  roomId: string,
  participantId: string,
  presentedOwnerToken: string | undefined,
): Promise<void> {
  const room = await tx.room.findUnique({ where: { id: roomId } });
  if (!room || !shouldBecomeOwner(room, presentedOwnerToken)) return;
  await tx.room.update({
    where: { id: roomId },
    data: { creatorParticipantId: participantId, ownershipVacant: false },
  });
}

// Called after the owner's row has been deleted or reset.
async function passOwnership(tx: Tx, roomId: string, leavingId: string): Promise<void> {
  const joined = await tx.participant.findMany({
    where: { roomId, joinedAt: { not: null } },
    select: { id: true, joinedAt: true, createdAt: true },
  });
  const next = pickSuccessor(joined, leavingId);
  await tx.room.update({
    where: { id: roomId },
    data: next
      ? { creatorParticipantId: next.id, ownershipVacant: false }
      : { creatorParticipantId: null, ownershipVacant: true },
  });
}

export type JoinByNameResult =
  | { kind: "joined"; cookieToken: string }
  // The name is taken, by someone who joined or by an invited name: the
  // caller shows the "is this you?" step, which claims it.
  | { kind: "exists"; participant: { id: string; name: string } }
  | { kind: "full" }
  | { kind: "roomGone" };

// `name` must already be validated (trimmed, 1–60 chars).
export async function joinByName(
  roomId: string,
  name: string,
  presentedOwnerToken: string | undefined,
): Promise<JoinByNameResult> {
  const nameKey = nameKeyOf(name);
  return prisma.$transaction(async (tx): Promise<JoinByNameResult> => {
    if (!(await lockRoomRow(tx, roomId))) return { kind: "roomGone" };

    const existing = await tx.participant.findUnique({
      where: { roomId_nameKey: { roomId, nameKey } },
      select: { id: true, name: true },
    });
    if (existing) return { kind: "exists", participant: existing };

    // Invited names hold places too, so the cap covers both.
    const count = await tx.participant.count({ where: { roomId } });
    if (count >= MAX_PARTICIPANTS_PER_ROOM) return { kind: "full" };

    const created = await tx.participant.create({
      data: { roomId, name, nameKey, cookieToken: generateCookieToken(), joinedAt: new Date() },
    });
    await assignOwnerIfEligible(tx, roomId, created.id, presentedOwnerToken);
    return { kind: "joined", cookieToken: created.cookieToken };
  });
}

export type ClaimResult = { kind: "claimed"; cookieToken: string } | { kind: "notFound" };

// The "is this you?" confirmation. Records the first join time of an
// invited name; claiming an already-joined participant (from another
// device) leaves its join time alone.
export async function claimParticipant(
  roomId: string,
  participantId: string,
  presentedOwnerToken: string | undefined,
): Promise<ClaimResult> {
  return prisma.$transaction(async (tx): Promise<ClaimResult> => {
    if (!(await lockRoomRow(tx, roomId))) return { kind: "notFound" };
    const participant = await tx.participant.findFirst({ where: { id: participantId, roomId } });
    if (!participant) return { kind: "notFound" };
    if (participant.joinedAt === null) {
      await tx.participant.update({ where: { id: participant.id }, data: { joinedAt: new Date() } });
    }
    await assignOwnerIfEligible(tx, roomId, participant.id, presentedOwnerToken);
    return { kind: "claimed", cookieToken: participant.cookieToken };
  });
}

export type LeaveOutcome = "deleted" | "reset" | "notFound";

// "Leave the room": deletes the participant, or under "listed names only"
// resets the name to unclaimed (leaveEffect). A leaving owner's room passes
// to the earliest joined participant, or becomes vacant.
export async function leaveRoomAs(roomId: string, actor: Actor): Promise<LeaveOutcome> {
  return prisma.$transaction(async (tx): Promise<LeaveOutcome> => {
    if (!(await lockRoomRow(tx, roomId))) return "notFound";
    const room = await tx.room.findUniqueOrThrow({ where: { id: roomId } });
    const participant = await findActor(tx, roomId, actor);
    if (!participant) return "notFound";

    const effect = leaveEffect(room.joinRule);
    if (effect === "delete") {
      await tx.participant.delete({ where: { id: participant.id } });
    } else {
      // Rotate the token before deleting marks: the row update waits for
      // any in-flight saveMarks holding this row, so the delete below also
      // removes whatever that save wrote (D012). The new token means the
      // leaver's cookie no longer identifies anyone.
      await tx.participant.update({
        where: { id: participant.id },
        data: { joinedAt: null, cookieToken: generateCookieToken() },
      });
      await tx.availability.deleteMany({ where: { participantId: participant.id } });
    }

    if (room.creatorParticipantId === participant.id) {
      await passOwnership(tx, roomId, participant.id);
    }
    return effect === "delete" ? "deleted" : "reset";
  });
}

export type RemoveParticipantResult =
  | { ok: true }
  // Keys under ParticipantsPanel.errors (translated client-side).
  | { ok: false; error: "roomGone" | "notOwner" | "notFound" | "self" | "nameMismatch" };

// Owner removes another participant, joined or not, after typing their name
// (G-003). Ownership and the acting identity are re-read under the lock, so
// an ownership change racing this can't delete whoever just inherited the
// room, and a request from before a reset can't act as the name's new holder.
export async function removeParticipantConfirmed(
  roomId: string,
  actor: Actor,
  targetId: string,
  typedName: string,
): Promise<RemoveParticipantResult> {
  return prisma.$transaction(async (tx): Promise<RemoveParticipantResult> => {
    if (!(await lockRoomRow(tx, roomId))) return { ok: false, error: "roomGone" };
    const room = await tx.room.findUniqueOrThrow({ where: { id: roomId } });
    const acting = await findActor(tx, roomId, actor);
    if (!acting || room.creatorParticipantId !== acting.id) return { ok: false, error: "notOwner" };

    const target = await tx.participant.findFirst({ where: { id: targetId, roomId } });
    if (!target) return { ok: false, error: "notFound" };
    if (target.id === acting.id) return { ok: false, error: "self" };
    if (!confirmationMatches(typedName, target.name)) return { ok: false, error: "nameMismatch" };

    await tx.participant.delete({ where: { id: target.id } });
    return { ok: true };
  });
}

export type RemoveUnclaimedResult =
  | { ok: true }
  // "claimed": someone claimed the name meanwhile, so removing it now
  // needs the typed confirmation instead (G-004 AC4).
  | { ok: false; error: "roomGone" | "notOwner" | "notFound" | "claimed" };

// Owner removes an invited name nobody has claimed; nothing is lost, so no
// typed confirmation. The delete only matches a still-unclaimed row.
export async function removeUnclaimedParticipant(
  roomId: string,
  actor: Actor,
  targetId: string,
): Promise<RemoveUnclaimedResult> {
  return prisma.$transaction(async (tx): Promise<RemoveUnclaimedResult> => {
    if (!(await lockRoomRow(tx, roomId))) return { ok: false, error: "roomGone" };
    const room = await tx.room.findUniqueOrThrow({ where: { id: roomId } });
    const acting = await findActor(tx, roomId, actor);
    if (!acting || room.creatorParticipantId !== acting.id) return { ok: false, error: "notOwner" };

    const { count } = await tx.participant.deleteMany({
      where: { id: targetId, roomId, joinedAt: null },
    });
    if (count === 1) return { ok: true };
    const stillThere = await tx.participant.findFirst({
      where: { id: targetId, roomId },
      select: { id: true },
    });
    return { ok: false, error: stillThere ? "claimed" : "notFound" };
  });
}

export type MarkWrite = {
  slotDate: Date;
  slotHour: number;
  // null clears the slot.
  status: "CAN" | "CANNOT" | null;
  preferred: boolean;
};

type SetMark = MarkWrite & { status: "CAN" | "CANNOT" };

// Writes the acting participant's marks only while its cookie token still
// matches (D012). FOR SHARE on the participant row conflicts with the row
// update a reset or removal makes, so a save and a reset run one after the
// other: either the save commits first and the reset then deletes its marks,
// or the save finds the rotated token (or no row) and writes nothing.
// Deliberately no room lock, so paint strokes never queue behind membership
// changes.
export async function saveMarks(
  roomId: string,
  actor: Actor,
  slots: MarkWrite[],
): Promise<"saved" | "removed"> {
  // A slot repeated within one request: the last write wins.
  const bySlot = new Map<string, MarkWrite>();
  for (const s of slots) bySlot.set(`${s.slotDate.toISOString()}|${s.slotHour}`, s);
  const unique = [...bySlot.values()];

  return prisma.$transaction(async (tx): Promise<"saved" | "removed"> => {
    const held = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Participant"
      WHERE "id" = ${actor.participantId} AND "roomId" = ${roomId} AND "cookieToken" = ${actor.cookieToken}
      FOR SHARE`;
    if (held.length === 0) return "removed";
    if (unique.length === 0) return "saved";

    await tx.availability.deleteMany({
      where: {
        participantId: actor.participantId,
        OR: unique.map((s) => ({ slotDate: s.slotDate, slotHour: s.slotHour })),
      },
    });
    const marks = unique.filter((s): s is SetMark => s.status !== null);
    if (marks.length > 0) {
      await tx.availability.createMany({
        data: marks.map((s) => ({
          participantId: actor.participantId,
          slotDate: s.slotDate,
          slotHour: s.slotHour,
          status: s.status,
          // "Preferred" only means something on a CAN slot; enforced here,
          // not just in the client brush logic.
          preferred: s.status === "CAN" && s.preferred,
        })),
      });
    }
    return "saved";
  });
}
