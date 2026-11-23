import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui-kit";

// In place of the grid once the owner has set the meeting time.
export async function PlanningClosed() {
  const t = await getTranslations("RoomPage");
  return <EmptyState title={t("closedEmpty")} className="rounded-md border border-dashed border-border py-6" />;
}
