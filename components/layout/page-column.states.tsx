import type { UiStates } from "@/components/ui-kit";
import { PageColumn } from "./page-column";

const states: UiStates = [
  {
    name: "narrow, with an action",
    render: () => (
      <PageColumn width="narrow" actions="Action">
        Content of a single form
      </PageColumn>
    ),
  },
  { name: "text", render: () => <PageColumn width="text">Running text, up to the measure</PageColumn> },
  { name: "table", render: () => <PageColumn width="table">A table</PageColumn> },
  { name: "wide", render: () => <PageColumn width="wide">A room and its grid</PageColumn> },
];
export default states;
