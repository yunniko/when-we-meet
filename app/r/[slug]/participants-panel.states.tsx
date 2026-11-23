import type { UiStates } from "@/components/ui-kit";
import { ROOM } from "@/app/dev/ui-kit/samples";
import { ParticipantsPanel } from "./participants-panel";

const others = [
  { id: "p-boris", name: "Boris", invited: false, left: false },
  { id: "p-chiara", name: "Chiara", invited: true, left: false },
  { id: "p-dana", name: "Dana", invited: true, left: true },
];

const states: UiStates = [
  {
    name: "alone in the room",
    render: () => <ParticipantsPanel roomId={ROOM.roomId} slug={ROOM.slug} ownerName="Anna" others={[]} joinRule="ANYONE" />,
  },
  {
    name: "joined, invited and left",
    render: () => <ParticipantsPanel roomId={ROOM.roomId} slug={ROOM.slug} ownerName="Anna" others={others} joinRule="LISTED_ONLY" />,
  },
];
export default states;
