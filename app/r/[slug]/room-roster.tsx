import { getTranslations } from "next-intl/server";
import { TextLink } from "@/components/layout/text-link";

// The line above the grid: who else is here, who is invited, and the way to the results.
export async function RoomRoster({ joined, invited, resultsHref }: { joined: string[]; invited: string[]; resultsHref: string }) {
  const t = await getTranslations("RoomPage");
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0 text-sm break-words text-text-muted">
        {joined.length > 0 && <p>{t("alsoInRoom", { names: joined.join(", ") })}</p>}
        {invited.length > 0 && <p>{t("notJoinedYet", { names: invited.join(", ") })}</p>}
      </div>
      <TextLink href={resultsHref} size="sm">
        {t("seeResults")}
      </TextLink>
    </div>
  );
}
