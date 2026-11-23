import type { UiStates } from "@/components/ui-kit";
import { DATES, HOURS, MARKS, ROOM } from "@/app/dev/ui-kit/samples";
import { AvailabilityGrid } from "./availability-grid";

const states: UiStates = [
  {
    name: "nothing marked",
    render: () => <AvailabilityGrid {...ROOM} participantId="ui-kit-empty" dates={DATES} hours={HOURS} initialAvailability={{}} />,
  },
  {
    name: "can, cannot and preferred marks",
    render: () => <AvailabilityGrid {...ROOM} dates={DATES} hours={HOURS} initialAvailability={MARKS} />,
  },
  {
    name: "one day, one hour",
    render: () => (
      <AvailabilityGrid
        {...ROOM}
        participantId="ui-kit-single"
        dates={DATES.slice(0, 1)}
        hours={HOURS.slice(0, 1)}
        initialAvailability={{}}
      />
    ),
  },
];
export default states;
