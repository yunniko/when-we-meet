import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui-kit";
import type { JoinRuleValue } from "@/lib/roster";
import { NewEventButton } from "@/app/new-event-button";
import { leaveIdentity } from "./actions";
import { LeaveRoomButton } from "./leave-room-button";

// Who is marking, and the ways out: another name on this device, or leaving the room.
export async function IdentityPanel({
  roomId,
  slug,
  name,
  joinRule,
}: {
  roomId: string;
  slug: string;
  name: string;
  joinRule: JoinRuleValue;
}) {
  const t = await getTranslations("RoomPage");
  return (
    <>
      <NewEventButton />
      <p>{t.rich("markingAs", { name, b: (chunks) => <span className="font-medium">{chunks}</span> })}</p>
      <form action={leaveIdentity.bind(null, { roomId, slug })}>
        <Button type="submit" variant="muted-link" className="text-xs">
          {t("notYou")}
        </Button>
      </form>
      <LeaveRoomButton roomId={roomId} slug={slug} joinRule={joinRule} />
    </>
  );
}
