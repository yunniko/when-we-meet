import "server-only";
import { prisma } from "@/lib/prisma";
import { getOwnerToken } from "@/lib/cookies";
import { getCurrentParticipant } from "@/lib/participant";

// Creator permission lives on Room.creatorParticipantId, not a standalone
// cookie — so it's recovered the same way participant identity is: rejoin
// under the creator's name via the ordinary name-collision "is this you?"
// flow. This checks whichever participant the current browser is logged in
// as (via the normal participant cookie).
export async function isRoomOwner(room: {
  id: string;
  creatorParticipantId: string | null;
}): Promise<boolean> {
  if (!room.creatorParticipantId) return false;
  const participant = await getCurrentParticipant(room.id);
  return participant?.id === room.creatorParticipantId;
}

// Called once, right after a participant is created or claimed in joinRoom:
// if this browser is the one that created the room (proven by the one-shot
// ownerToken cookie) and nobody has been tagged as creator yet, tag this
// participant. A no-op in every other case.
export async function claimCreatorIfEligible(
  roomId: string,
  participantId: string,
): Promise<void> {
  const ownerToken = await getOwnerToken(roomId);
  if (!ownerToken) return;

  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room || room.ownerToken !== ownerToken || room.creatorParticipantId) return;

  await prisma.room.update({
    where: { id: roomId },
    data: { creatorParticipantId: participantId },
  });
}
