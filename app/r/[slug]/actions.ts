"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getOwnerToken, setParticipantCookie, clearParticipantCookie } from "@/lib/cookies";
import { getCurrentParticipant } from "@/lib/participant";
import { findActiveRoom } from "@/lib/room-access";
import {
  claimParticipant,
  joinByName,
  leaveRoomAs,
  removeParticipantConfirmed,
  saveMarks,
  type RemoveParticipantResult,
} from "@/lib/membership";
import { isRoomOwner } from "@/lib/owner";
import { isSlotInFuture } from "@/lib/time";
import { summarizeAvailability, type MarkSummary } from "@/lib/slots";
import type { SlotUpdate } from "@/lib/paint";

export type { RemoveParticipantResult };

export type JoinState =
  // error is an i18n KEY under JoinForm.errors, not an English sentence —
  // translated client-side in join-form.tsx (same pattern as CreateRoom's
  // errors, see lib/validation.ts's header comment).
  | { step: "form"; error?: string; name?: string }
  | {
      step: "collision";
      participantId: string;
      name: string;
      // An invited name nobody has claimed yet (G-004): shown as "on the
      // invite list" rather than as someone's existing marks.
      invited: boolean;
      summary: MarkSummary;
    };

async function collisionState(participant: {
  id: string;
  name: string;
  joinedAt: Date | null;
}): Promise<JoinState> {
  const availability = await prisma.availability.findMany({
    where: { participantId: participant.id },
    orderBy: [{ slotDate: "asc" }, { slotHour: "asc" }],
  });
  return {
    step: "collision",
    participantId: participant.id,
    name: participant.name,
    invited: participant.joinedAt === null,
    summary: summarizeAvailability(availability),
  };
}

export async function joinRoom(
  ctx: { roomId: string; slug: string },
  _prev: JoinState,
  formData: FormData,
): Promise<JoinState> {
  // Ownership, capacity and name uniqueness are decided in lib/membership.ts
  // under the room lock (D010, D011); this action validates input and turns
  // the outcome into form state.
  const ownerToken = await getOwnerToken(ctx.roomId);

  const confirmId = formData.get("confirmParticipantId");
  if (typeof confirmId === "string" && confirmId) {
    const claimed = await claimParticipant(ctx.roomId, confirmId, ownerToken);
    if (claimed.kind === "notFound") {
      return { step: "form", error: "confirmFailed" };
    }
    await setParticipantCookie(ctx.roomId, claimed.cookieToken);
    redirect(`/r/${ctx.slug}`);
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { step: "form", error: "nameRequired" };
  if (name.length > 60) return { step: "form", error: "nameTooLong", name };

  const joined = await joinByName(ctx.roomId, name, ownerToken);
  if (joined.kind === "roomGone") {
    // Expired or deleted meanwhile; the room page shows not-found.
    redirect(`/r/${ctx.slug}`);
  }
  if (joined.kind === "notOnList") return { step: "form", error: "notOnList", name };
  if (joined.kind === "full") return { step: "form", error: "roomFull", name };
  if (joined.kind === "exists") return collisionState(joined.participant);

  await setParticipantCookie(ctx.roomId, joined.cookieToken);
  redirect(`/r/${ctx.slug}`);
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
// participant and every mark they made, or under "listed names only" resets
// the name to unclaimed; a leaving owner's room passes on (lib/membership.ts).
// Irreversible, so the UI gates it behind a confirmation step; identity comes
// from the cookie, never from a client-supplied id.
export async function leaveRoom(
  ctx: { roomId: string; slug: string },
  _formData: FormData,
): Promise<void> {
  const participant = await getCurrentParticipant(ctx.roomId);
  if (participant) {
    await leaveRoomAs(ctx.roomId, {
      participantId: participant.id,
      cookieToken: participant.cookieToken,
    });
  }
  await clearParticipantCookie(ctx.roomId);
  redirect(`/r/${ctx.slug}`);
}

// Owner-only removal of another participant and all of their marks (G-003).
// The room is resolved through findActiveRoom and identity from the cookie;
// ownership, the target and the typed name are checked under the room lock
// in lib/membership.ts, so a crafted request can't skip the confirmation.
export async function removeParticipant(
  ctx: { roomId: string; slug: string },
  input: { participantId: string; typedName: string },
): Promise<RemoveParticipantResult> {
  const room = await findActiveRoom(ctx.slug);
  if (!room || room.id !== ctx.roomId) return { ok: false, error: "roomGone" };

  const current = await getCurrentParticipant(room.id);
  if (!current) return { ok: false, error: "notOwner" };

  const result = await removeParticipantConfirmed(
    room.id,
    { participantId: current.id, cookieToken: current.cookieToken },
    input.participantId,
    input.typedName,
  );
  if (result.ok) {
    revalidatePath(`/r/${ctx.slug}`);
    revalidatePath(`/r/${ctx.slug}/results`);
  }
  return result;
}

export type { SlotUpdate };

// A room's grid can never legitimately have more distinct slots than its
// own bounds allow (60-day range cap × 24 hours = 1440, see
// lib/validation.ts). This request isn't shaped like a real paint stroke
// (those touch at most a few dozen cells) — it's a hard ceiling against a
// scripted request bypassing the grid UI entirely and submitting an
// oversized/duplicated array to force an expensive transaction.
const MAX_SLOTS_PER_SAVE = 1500;

export type SaveAvailabilityResult =
  | { ok: true }
  // "removed": the cookie no longer maps to a participant in this room (the
  // owner removed them, or they left in another tab). "mismatch": the grid
  // was rendered for a different participant than the cookie now names
  // (identity switched in another tab). Both mean the page must reload;
  // anything else is a plain save failure.
  | { ok: false; code: "removed" | "mismatch" | "failed"; error: string };

export async function saveAvailability(
  roomId: string,
  expectedParticipantId: string,
  slots: SlotUpdate[],
): Promise<SaveAvailabilityResult> {
  if (slots.length > MAX_SLOTS_PER_SAVE) {
    return { ok: false, code: "failed", error: "Too many slots in one request." };
  }

  const participant = await getCurrentParticipant(roomId);
  if (!participant) {
    return { ok: false, code: "removed", error: "You're not joined in this room." };
  }
  if (participant.id !== expectedParticipantId) {
    return { ok: false, code: "mismatch", error: "This grid belongs to a different name." };
  }

  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) return { ok: false, code: "failed", error: "Room not found." };
  if (room.selectedDate !== null) {
    // Never trust the client to have hidden the grid controls — the lock is
    // a data-integrity rule, enforced here regardless of what the UI shows.
    return {
      ok: false,
      code: "failed",
      error: "The meeting time has been set — availability marking is closed.",
    };
  }

  const validSlots = slots.filter((s) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date)) return false;
    if (!Number.isInteger(s.hour) || s.hour < 0 || s.hour > 23) return false;
    const day = new Date(`${s.date}T00:00:00Z`);
    return day >= room.startDate && day <= room.endDate;
  });

  // Identity is re-checked inside the write by cookie token (D012), so a
  // reset or removal landing after the lookup above makes this refuse
  // instead of writing marks onto a name someone else will claim.
  const saved = await saveMarks(
    roomId,
    { participantId: participant.id, cookieToken: participant.cookieToken },
    validSlots.map((s) => ({
      slotDate: new Date(`${s.date}T00:00:00Z`),
      slotHour: s.hour,
      status: s.status,
      preferred: s.preferred,
    })),
  );
  if (saved === "removed") {
    return { ok: false, code: "removed", error: "You're not joined in this room." };
  }
  return { ok: true };
}

// Sets or clears the meeting time only while the current browser still owns
// the room at the moment of writing (same id and cookie token, D012). An
// ownership change after the isRoomOwner check makes this match nothing.
async function updateRoomAsOwner(
  roomId: string,
  data: { selectedDate: Date | null; selectedHour: number | null },
): Promise<boolean> {
  const current = await getCurrentParticipant(roomId);
  if (!current) return false;
  const { count } = await prisma.room.updateMany({
    where: {
      id: roomId,
      creatorParticipantId: current.id,
      creator: { is: { cookieToken: current.cookieToken } },
    },
    data,
  });
  return count === 1;
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

  if (!(await updateRoomAsOwner(ctx.roomId, { selectedDate: slotDate, selectedHour: hour }))) {
    return { ok: false, error: "notOwner" };
  }
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

  if (!(await updateRoomAsOwner(ctx.roomId, { selectedDate: null, selectedHour: null }))) {
    return { ok: false, error: "Only the room's creator can clear the meeting time." };
  }
  revalidatePath(`/r/${ctx.slug}`);
  revalidatePath(`/r/${ctx.slug}/results`);
  return { ok: true };
}
