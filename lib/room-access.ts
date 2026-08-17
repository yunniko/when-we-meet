import "server-only";
import { prisma } from "@/lib/prisma";
import { isRoomExpired } from "@/lib/expiry";

// Every page that loads a room by slug should go through this instead of
// `prisma.room.findUnique` directly, so the 3-days-after-the-fact expiry
// policy (see lib/expiry.ts) is enforced consistently: an expired room is
// deleted on next access and treated as not found.
export async function findActiveRoom(slug: string) {
  const room = await prisma.room.findUnique({ where: { slug } });
  if (!room) return null;
  if (isRoomExpired(room)) {
    // Best-effort: another request may have already deleted it (e.g. the
    // cleanup script racing this one) — either way, it's gone.
    await prisma.room.delete({ where: { id: room.id } }).catch(() => {});
    return null;
  }
  return room;
}
