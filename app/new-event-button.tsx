import Link from "next/link";
import { getTranslations } from "next-intl/server";

export async function NewEventButton() {
  const t = await getTranslations("Common");
  return (
    <Link
      href="/"
      className="inline-block rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted hover:border-accent hover:text-accent"
    >
      + {t("newEvent")}
    </Link>
  );
}
