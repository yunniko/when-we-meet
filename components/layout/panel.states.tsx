import type { UiStates } from "@/components/ui-kit";
import { Panel } from "./panel";

const states: UiStates = [
  { name: "default", render: () => <Panel>Panel content</Panel> },
  { name: "roomy", render: () => <Panel padding="roomy">Panel content with more air on wide screens</Panel> },
  { name: "flush", render: () => <Panel padding="flush">Content that runs to the edge</Panel> },
];
export default states;
