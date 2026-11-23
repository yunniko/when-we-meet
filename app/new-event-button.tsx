import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonClass } from "@/components/ui-kit";

export async function NewEventButton() {
  const t = await getTranslations("Common");
  return (
    <Link href="/" className={buttonClass("secondary", "sm")}>
      + {t("newEvent")}
    </Link>
  );
}
