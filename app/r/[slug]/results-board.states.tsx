import type { UiStates } from "@/components/ui-kit";
import { DATES, HOURS, RESULTS, ROOM, TOP_RESULTS } from "@/app/dev/ui-kit/samples";
import { ResultsBoard } from "./results-board";

const board = (canPick: boolean, empty = false) => (
  <ResultsBoard
    roomId={ROOM.roomId}
    slug={ROOM.slug}
    dates={DATES}
    hours={HOURS}
    results={empty ? [] : RESULTS}
    topResults={empty ? [] : TOP_RESULTS}
    canPick={canPick}
  />
);

const states: UiStates = [
  { name: "owner, can pick a time", render: () => board(true) },
  { name: "guest", render: () => board(false) },
  { name: "nobody has marked anything", render: () => board(false, true) },
];
export default states;
