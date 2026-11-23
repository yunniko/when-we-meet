import type { UiStates } from "@/components/ui-kit";
import { NewEventButton } from "@/app/new-event-button";
import { RoomHeader } from "./room-header";

const DETAILS = "12 Mar – 15 Mar 2027 · 17:00–22:00 · Europe/Prague";

const states: UiStates = [
  {
    name: "with a description",
    render: () => (
      <RoomHeader title="Team dinner" details={[DETAILS]} description="Somewhere near the office." actions={<NewEventButton />} />
    ),
  },
  {
    name: "several lines, long names",
    render: () => (
      <RoomHeader
        title="Results: Team dinner"
        details={[`${DETAILS} · 3 people`, "Participants: Anna, Boris, Chiara-Maria Fernández-Oyelaran"]}
        actions={<NewEventButton />}
      />
    ),
  },
];
export default states;
