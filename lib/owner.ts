import "server-only";
import { getCurrentParticipant } from "@/lib/participant";

// Creator permission lives on Room.creatorParticipantId, not a standalone
// cookie — so it's recovered the same way participant identity is: rejoin
// under the creator's name via the ordinary name-collision "is this you?"
// flow. This checks whichever participant the current browser is logged in
// as (via the normal participant cookie). Who becomes owner, and when, is
// decided in lib/membership.ts (rule: shouldBecomeOwner in lib/roster.ts).
export async function isRoomOwner(room: {
  id: string;
  creatorParticipantId: string | null;
}): Promise<boolean> {
  if (!room.creatorParticipantId) return false;
  const participant = await getCurrentParticipant(room.id);
  return participant?.id === room.creatorParticipantId;
}
