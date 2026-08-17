import { customAlphabet, nanoid } from "nanoid";

// Unambiguous alphabet (no 0/O/1/I/l) — rooms get shared by URL, so a typo-
// resistant slug matters more than raw entropy. 12 chars keeps rooms
// effectively unguessable while staying short enough to read aloud.
const alphabet = "23456789abcdefghjkmnpqrstuvwxyz";
const generate = customAlphabet(alphabet, 12);

export function generateRoomSlug(): string {
  return generate();
}

// Cookie identity token (participants and room owners alike) — never typed
// or shared, so full nanoid entropy (not the unambiguous slug alphabet) is
// fine here.
export function generateCookieToken(): string {
  return nanoid(32);
}
