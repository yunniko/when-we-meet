"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { generateRoomSlug, generateCookieToken } from "@/lib/slug";
import { createRoomSchema } from "@/lib/validation";
import { setOwnerCookie } from "@/lib/cookies";
import { DAILY_PRESETS, isPresetKey } from "@/lib/room-presets";

export type CreateRoomState = {
  // i18n KEYS under CreateRoom.errors, not English sentences — translated
  // client-side in create-room-form.tsx (see lib/validation.ts's header).
  error?: string;
  fieldErrors?: Record<string, string>;
  values: {
    title: string;
    description: string;
    timezone: string;
    startDate: string;
    endDate: string;
    dayStartHour: string;
    dayEndHour: string;
  };
};

export async function createRoom(
  _prevState: CreateRoomState,
  formData: FormData,
): Promise<CreateRoomState> {
  const presetRaw = String(formData.get("preset") ?? "");
  const preset = isPresetKey(presetRaw) ? presetRaw : "custom";
  const fromPreset = preset !== "custom" ? DAILY_PRESETS[preset] : null;

  const raw = {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    timezone: String(formData.get("timezone") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    dayStartHour: fromPreset ? String(fromPreset.start) : String(formData.get("dayStartHour") ?? "0"),
    dayEndHour: fromPreset ? String(fromPreset.end) : String(formData.get("dayEndHour") ?? "24"),
  };

  const values = raw;

  const parsed = createRoomSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return { error: "invalidInput", fieldErrors, values };
  }

  const data = parsed.data;

  let slug = generateRoomSlug();
  // Collision is astronomically unlikely at 12 chars from a 32-symbol
  // alphabet, but retry a couple of times rather than trust that blindly.
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await prisma.room.findUnique({ where: { slug } });
    if (!existing) break;
    slug = generateRoomSlug();
  }

  const ownerToken = generateCookieToken();
  const room = await prisma.room.create({
    data: {
      slug,
      title: data.title,
      description: data.description,
      timezone: data.timezone,
      startDate: new Date(`${data.startDate}T00:00:00Z`),
      endDate: new Date(`${data.endDate}T00:00:00Z`),
      dayStartHour: data.dayStartHour,
      dayEndHour: data.dayEndHour,
      ownerToken,
    },
  });
  await setOwnerCookie(room.id, ownerToken);

  redirect(`/r/${room.slug}`);
}
