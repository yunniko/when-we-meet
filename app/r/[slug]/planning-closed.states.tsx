import type { UiStates } from "@/components/ui-kit";
import { PlanningClosed } from "./planning-closed";

const states: UiStates = [{ name: "meeting time set", render: () => <PlanningClosed /> }];
export default states;
