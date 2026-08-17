import "server-only";
import { prisma } from "@/lib/prisma";
import { getParticipantToken } from "@/lib/cookies";

export async function getCurrentParticipant(roomId: string) {
  const token = await getParticipantToken(roomId);
  if (!token) return null;
  return prisma.participant.findFirst({ where: { roomId, cookieToken: token } });
}
