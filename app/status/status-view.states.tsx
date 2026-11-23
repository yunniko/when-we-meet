import type { UiStates } from "@/components/ui-kit";
import { StatusView } from "./status-view";

const ROOMS = [
  { id: "a", title: "Team dinner", created: "2027-03-01 18:04 UTC", expired: false, joined: 3, invited: 1 },
  { id: "b", title: "", created: "2027-02-11 09:30 UTC", expired: true, joined: 1, invited: 0 },
];

const states: UiStates = [
  {
    name: "a middle page",
    render: () => (
      <StatusView totals={{ rooms: 52, joined: 140, invited: 12 }} rooms={ROOMS} page={2} totalPages={3} prevHref="#" nextHref="#" />
    ),
  },
  {
    name: "no rooms",
    render: () => (
      <StatusView totals={{ rooms: 0, joined: 0, invited: 0 }} rooms={[]} page={1} totalPages={1} prevHref={null} nextHref={null} />
    ),
  },
];
export default states;
