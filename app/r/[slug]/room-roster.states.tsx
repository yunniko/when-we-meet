import type { UiStates } from "@/components/ui-kit";
import { RoomRoster } from "./room-roster";

const states: UiStates = [
  { name: "alone", render: () => <RoomRoster joined={[]} invited={[]} resultsHref="#" /> },
  { name: "others joined and invited", render: () => <RoomRoster joined={["Boris", "Chiara"]} invited={["Dana"]} resultsHref="#" /> },
];
export default states;
