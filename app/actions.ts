"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { generateRoomSlug } from "@/lib/slug";
import { createRoomSchema } from "@/lib/validation";

export type CreateRoomState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  values: {
    title: string;
    timezone: string;
    startDate: string;
    endDate: string;
    allDay: boolean;
    dayStartHour: string;
    dayEndHour: string;
  };
};

export async function createRoom(
  _prevState: CreateRoomState,
  formData: FormData,
): Promise<CreateRoomState> {
  const allDay = formData.get("allDay") === "on";
  const raw = {
    title: String(formData.get("title") ?? ""),
    timezone: String(formData.get("timezone") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    dayStartHour: allDay ? "0" : String(formData.get("dayStartHour") ?? "0"),
    dayEndHour: allDay ? "24" : String(formData.get("dayEndHour") ?? "24"),
  };

  const values = { ...raw, allDay };

  const parsed = createRoomSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return { error: "Please fix the highlighted fields.", fieldErrors, values };
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

  const room = await prisma.room.create({
    data: {
      slug,
      title: data.title,
      timezone: data.timezone,
      startDate: new Date(`${data.startDate}T00:00:00Z`),
      endDate: new Date(`${data.endDate}T00:00:00Z`),
      dayStartHour: data.dayStartHour,
      dayEndHour: data.dayEndHour,
    },
  });

  redirect(`/r/${room.slug}`);
}
