"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { generateCookieToken } from "@/lib/slug";
import { setParticipantCookie, clearParticipantCookie } from "@/lib/cookies";
import { getCurrentParticipant } from "@/lib/participant";
import { claimCreatorIfEligible, isRoomOwner } from "@/lib/owner";
import { isSlotInFuture } from "@/lib/time";
import { summarizeAvailability, type MarkSummary } from "@/lib/slots";
import type { SlotStatus } from "@/lib/slots";
import { MAX_PARTICIPANTS_PER_ROOM } from "@/lib/validation";

export type JoinState =
  // error is an i18n KEY under JoinForm.errors, not an English sentence —
  // translated client-side in join-form.tsx (same pattern as CreateRoom's
  // errors, see lib/validation.ts's header comment).
  | { step: "form"; error?: string; name?: string }
  | { step: "collision"; participantId: string; name: string; summary: MarkSummary };

async function collisionState(participant: { id: string; name: string }): Promise<JoinState> {
  const availability = await prisma.availability.findMany({
    where: { participantId: participant.id },
    orderBy: [{ slotDate: "asc" }, { slotHour: "asc" }],
  });
  return {
    step: "collision",
    participantId: participant.id,
    name: participant.name,
    summary: summarizeAvailability(availability),
  };
}

export async function joinRoom(
  ctx: { roomId: string; slug: string },
  _prev: JoinState,
  formData: FormData,
): Promise<JoinState> {
  const confirmId = formData.get("confirmParticipantId");
  if (typeof confirmId === "string" && confirmId) {
    const participant = await prisma.participant.findFirst({
      where: { id: confirmId, roomId: ctx.roomId },
    });
    if (!participant) {
      return { step: "form", error: "confirmFailed" };
    }
    await setParticipantCookie(ctx.roomId, participant.cookieToken);
    await claimCreatorIfEligible(ctx.roomId, participant.id);
    redirect(`/r/${ctx.slug}`);
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { step: "form", error: "nameRequired" };
  if (name.length > 60) return { step: "form", error: "nameTooLong", name };

  const nameKey = name.toLowerCase();
  const existing = await prisma.participant.findUnique({
    where: { roomId_nameKey: { roomId: ctx.roomId, nameKey } },
  });

  if (!existing) {
    const participantCount = await prisma.participant.count({ where: { roomId: ctx.roomId } });
    if (participantCount >= MAX_PARTICIPANTS_PER_ROOM) {
      return { step: "form", error: "roomFull", name };
    }

    try {
      const created = await prisma.participant.create({
        data: {
          roomId: ctx.roomId,
          name,
          nameKey,
          cookieToken: generateCookieToken(),
        },
      });
      await setParticipantCookie(ctx.roomId, created.cookieToken);
      await claimCreatorIfEligible(ctx.roomId, created.id);
      redirect(`/r/${ctx.slug}`);
    } catch (err) {
      // Two people submitting the same new name at the same instant can
      // both pass the findUnique check above before either commits — the
      // second create() then hits the (roomId, nameKey) unique constraint.
      // Recover by treating it as a same-instant collision instead of
      // surfacing a raw 500.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const racedWinner = await prisma.participant.findUnique({
          where: { roomId_nameKey: { roomId: ctx.roomId, nameKey } },
        });
        if (racedWinner) return collisionState(racedWinner);
      }
      throw err;
    }
  }

  return collisionState(existing);
}

export async function leaveIdentity(
  ctx: { roomId: string; slug: string },
  _formData: FormData,
): Promise<void> {
  await clearParticipantCookie(ctx.roomId);
  redirect(`/r/${ctx.slug}`);
}

// Distinct from leaveIdentity: that one just switches whose cookie is
// active (the participant and their marks stay in the room, reclaimable
// later via the name-collision "is this you?" flow). This one deletes the
// participant's row — and, via the Availability -> Participant cascade,
// every mark they made — permanently. Irreversible, so the UI gates this
// behind an explicit confirmation step; this action itself re-derives the
// participant from the cookie rather than trusting a client-supplied id,
// same as everywhere else in this file.
export async function leaveRoom(
  ctx: { roomId: string; slug: string },
  _formData: FormData,
): Promise<void> {
  const participant = await getCurrentParticipant(ctx.roomId);
  if (participant) {
    const room = await prisma.room.findUnique({ where: { id: ctx.roomId } });
    const wasCreator = room?.creatorParticipantId === participant.id;

    await prisma.participant.delete({ where: { id: participant.id } });

    if (wasCreator) {
      // Hand creator permissions to whoever's been in the room longest, so
      // someone can still finalize/clear a meeting time rather than leaving
      // the room permanently ownerless. If nobody's left, it just has no
      // creator — same as if the original creator had never joined (D7).
      const next = await prisma.participant.findFirst({
        where: { roomId: ctx.roomId },
        orderBy: { createdAt: "asc" },
      });
      await prisma.room.update({
        where: { id: ctx.roomId },
        data: { creatorParticipantId: next?.id ?? null },
      });
    }
  }
  await clearParticipantCookie(ctx.roomId);
  redirect(`/r/${ctx.slug}`);
}

export type SlotUpdate = {
  date: string;
  hour: number;
  status: SlotStatus | null;
  preferred: boolean;
};

// A room's grid can never legitimately have more distinct slots than its
// own bounds allow (60-day range cap × 24 hours = 1440, see
// lib/validation.ts). This request isn't shaped like a real paint stroke
// (those touch at most a few dozen cells) — it's a hard ceiling against a
// scripted request bypassing the grid UI entirely and submitting an
// oversized/duplicated array to force an expensive transaction.
const MAX_SLOTS_PER_SAVE = 1500;

export async function saveAvailability(
  roomId: string,
  slots: SlotUpdate[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (slots.length > MAX_SLOTS_PER_SAVE) {
    return { ok: false, error: "Too many slots in one request." };
  }

  const participant = await getCurrentParticipant(roomId);
  if (!participant) return { ok: false, error: "You're not joined in this room." };

  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) return { ok: false, error: "Room not found." };
  if (room.selectedDate !== null) {
    // Never trust the client to have hidden the grid controls — the lock is
    // a data-integrity rule, enforced here regardless of what the UI shows.
    return { ok: false, error: "The meeting time has been set — availability marking is closed." };
  }

  const validSlots = slots.filter((s) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date)) return false;
    if (!Number.isInteger(s.hour) || s.hour < 0 || s.hour > 23) return false;
    const day = new Date(`${s.date}T00:00:00Z`);
    return day >= room.startDate && day <= room.endDate;
  });

  await prisma.$transaction(
    validSlots.map((s) => {
      const slotDate = new Date(`${s.date}T00:00:00Z`);
      if (s.status === null) {
        return prisma.availability.deleteMany({
          where: { participantId: participant.id, slotDate, slotHour: s.hour },
        });
      }
      // "Preferred" is only meaningful on CAN slots — enforce that
      // server-side too, not just in the client brush logic (defense in
      // depth: never trust the client for a data-integrity rule).
      const preferred = s.status === "CAN" ? s.preferred : false;
      return prisma.availability.upsert({
        where: {
          participantId_slotDate_slotHour: {
            participantId: participant.id,
            slotDate,
            slotHour: s.hour,
          },
        },
        create: {
          participantId: participant.id,
          slotDate,
          slotHour: s.hour,
          status: s.status,
          preferred,
        },
        update: { status: s.status, preferred },
      });
    }),
  );

  return { ok: true };
}

// Both the creator-only checks below are re-verified here even though the
// UI only shows these controls to the creator — the same "never trust the
// client" rule as everywhere else in this file.
//
// Errors returned here are i18n KEYS under ResultsBoard.errors, not English
// sentences — translated client-side in results-board.tsx, the only place
// that currently surfaces them (deselectFinalSlot's errors below are never
// displayed, so they stay plain English — nothing to translate for now).
export async function selectFinalSlot(
  ctx: { roomId: string; slug: string },
  date: string,
  hour: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const room = await prisma.room.findUnique({ where: { id: ctx.roomId } });
  if (!room) return { ok: false, error: "roomNotFound" };
  if (!(await isRoomOwner(room))) {
    return { ok: false, error: "notOwner" };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(hour) || hour < 0 || hour > 23) {
    return { ok: false, error: "invalidSlot" };
  }
  const slotDate = new Date(`${date}T00:00:00Z`);
  if (slotDate < room.startDate || slotDate > room.endDate || hour < room.dayStartHour || hour >= room.dayEndHour) {
    return { ok: false, error: "outOfRange" };
  }
  if (!isSlotInFuture(date, hour, room.timezone)) {
    return { ok: false, error: "notFuture" };
  }

  await prisma.room.update({
    where: { id: ctx.roomId },
    data: { selectedDate: slotDate, selectedHour: hour },
  });
  revalidatePath(`/r/${ctx.slug}`);
  revalidatePath(`/r/${ctx.slug}/results`);
  return { ok: true };
}

export async function deselectFinalSlot(
  ctx: { roomId: string; slug: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const room = await prisma.room.findUnique({ where: { id: ctx.roomId } });
  if (!room) return { ok: false, error: "Room not found." };
  if (!(await isRoomOwner(room))) {
    return { ok: false, error: "Only the room's creator can clear the meeting time." };
  }

  await prisma.room.update({
    where: { id: ctx.roomId },
    data: { selectedDate: null, selectedHour: null },
  });
  revalidatePath(`/r/${ctx.slug}`);
  revalidatePath(`/r/${ctx.slug}/results`);
  return { ok: true };
}
