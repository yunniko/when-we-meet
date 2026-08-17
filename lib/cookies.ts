import "server-only";
import { cookies } from "next/headers";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

function cookieName(roomId: string): string {
  return `wwm_p_${roomId}`;
}

export async function getParticipantToken(
  roomId: string,
): Promise<string | undefined> {
  const store = await cookies();
  return store.get(cookieName(roomId))?.value;
}

export async function setParticipantCookie(
  roomId: string,
  token: string,
): Promise<void> {
  const store = await cookies();
  store.set(cookieName(roomId), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function clearParticipantCookie(roomId: string): Promise<void> {
  const store = await cookies();
  store.delete(cookieName(roomId));
}
