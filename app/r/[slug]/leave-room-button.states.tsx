import type { UiStates } from "@/components/ui-kit";
import { ROOM } from "@/app/dev/ui-kit/samples";
import { LeaveRoomButton } from "./leave-room-button";

const states: UiStates = [
  { name: "anyone can join", render: () => <LeaveRoomButton roomId={ROOM.roomId} slug={ROOM.slug} joinRule="ANYONE" /> },
  {
    name: "listed names only (keeps the name)",
    render: () => <LeaveRoomButton roomId={ROOM.roomId} slug={ROOM.slug} joinRule="LISTED_ONLY" />,
  },
];
export default states;
