import type { UiStates } from "@/components/ui-kit";
import { DATES, ROOM } from "@/app/dev/ui-kit/samples";
import { FinalizedBanner } from "./finalized-banner";

const states: UiStates = [
  {
    name: "owner (can clear it)",
    render: () => <FinalizedBanner roomId={ROOM.roomId} slug={ROOM.slug} date={DATES[1]} hour={19} isOwner />,
  },
  { name: "guest", render: () => <FinalizedBanner roomId={ROOM.roomId} slug={ROOM.slug} date={DATES[1]} hour={19} isOwner={false} /> },
];
export default states;
