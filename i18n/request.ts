import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import enMessages from "../messages/en.json";
import { DEFAULT_LOCALE, enabledUiLocales, mergeMessages } from "@/lib/ui-locales";

export { DEFAULT_LOCALE };

// Locale comes from a cookie — no locale segment in URLs, so a shared room
// link means the same thing regardless of who opens it or what language
// they read it in (see HANDOVER D8). A locale's messages file can be
// partial; missing keys fall back to English key-by-key via mergeMessages
// rather than throwing or rendering blank.
export default getRequestConfig(async () => {
  const locales = enabledUiLocales();
  const cookieLocale = (await cookies()).get("locale")?.value;
  const locale =
    cookieLocale && locales.includes(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

  type Messages = Parameters<typeof mergeMessages>[0];
  let messages = enMessages as unknown as Messages;
  if (locale !== DEFAULT_LOCALE) {
    try {
      const overlay = (await import(`../messages/${locale}.json`)).default;
      messages = mergeMessages(messages, overlay as Messages);
    } catch {
      // No translation file yet — full English fallback
    }
  }

  return { locale, messages };
});
