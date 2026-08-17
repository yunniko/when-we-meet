"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { enabledUiLocales } from "@/lib/ui-locales";

// Locale switcher action: persists the UI language in a cookie (no locale
// URL segments — see HANDOVER D8). Only an enabled locale sticks.
export async function setLocaleAction(formData: FormData): Promise<void> {
  const locale = String(formData.get("locale") ?? "");
  if (!enabledUiLocales().includes(locale)) return;
  (await cookies()).set("locale", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
