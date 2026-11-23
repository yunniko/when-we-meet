import type { ComponentProps } from "react";
import type { UiStates } from "@/components/ui-kit";
import { ROOM } from "@/app/dev/ui-kit/samples";
import { JoinForm } from "./join-form";

const base: ComponentProps<typeof JoinForm> = {
  roomId: ROOM.roomId,
  slug: ROOM.slug,
  roomTitle: "Team dinner",
  roomDescription: "Somewhere near the office.",
  dateRangeLabel: "Mar 12 – Mar 15",
  hoursLabel: "17:00 – 22:00",
  timezone: "Europe/Prague",
  joinedNames: [],
  invitedNames: [],
  listedOnly: false,
  canUseAnyName: true,
};

// Its error messages are reached by submitting; each is shown in the Messages section at its slot's width.
const states: UiStates = [
  { name: "first to join, no title or description", render: () => <JoinForm {...base} roomTitle="" roomDescription={null} /> },
  { name: "others joined and invited", render: () => <JoinForm {...base} joinedNames={["Anna", "Boris"]} invitedNames={["Chiara"]} /> },
  {
    name: "listed names only",
    render: () => <JoinForm {...base} listedOnly canUseAnyName={false} joinedNames={["Anna"]} invitedNames={["Boris", "Chiara"]} />,
  },
];
export default states;
