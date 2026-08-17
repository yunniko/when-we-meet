"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { generateParticipantToken } from "@/lib/slug";
import { setParticipantCookie, clearParticipantCookie } from "@/lib/cookies";
import { getCurrentParticipant } from "@/lib/participant";
import { summarizeAvailability, type MarkSummary } from "@/lib/slots";
import type { SlotStatus } from "@/lib/slots";

export type JoinState =
  | { step: "form"; error?: string; name?: string }
  | { step: "collision"; participantId: string; name: string; summary: MarkSummary };

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
      return { step: "form", error: "That didn't work — try entering your name again." };
    }
    await setParticipantCookie(ctx.roomId, participant.cookieToken);
    redirect(`/r/${ctx.slug}`);
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { step: "form", error: "Enter a name." };
  if (name.length > 60) return { step: "form", error: "Name is too long.", name };

  const nameKey = name.toLowerCase();
  const existing = await prisma.participant.findUnique({
    where: { roomId_nameKey: { roomId: ctx.roomId, nameKey } },
  });

  if (!existing) {
    const created = await prisma.participant.create({
      data: {
        roomId: ctx.roomId,
        name,
        nameKey,
        cookieToken: generateParticipantToken(),
      },
    });
    await setParticipantCookie(ctx.roomId, created.cookieToken);
    redirect(`/r/${ctx.slug}`);
  }

  const availability = await prisma.availability.findMany({
    where: { participantId: existing.id },
    orderBy: [{ slotDate: "asc" }, { slotHour: "asc" }],
  });

  return {
    step: "collision",
    participantId: existing.id,
    name: existing.name,
    summary: summarizeAvailability(availability),
  };
}

export async function leaveIdentity(
  ctx: { roomId: string; slug: string },
  _formData: FormData,
): Promise<void> {
  await clearParticipantCookie(ctx.roomId);
  redirect(`/r/${ctx.slug}`);
}

export type SlotUpdate = { date: string; hour: number; status: SlotStatus | null };

export async function saveAvailability(
  roomId: string,
  slots: SlotUpdate[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const participant = await getCurrentParticipant(roomId);
  if (!participant) return { ok: false, error: "You're not joined in this room." };

  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) return { ok: false, error: "Room not found." };

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
        },
        update: { status: s.status },
      });
    }),
  );

  return { ok: true };
}
