import type { UiStates } from "@/components/ui-kit";
import { CreateRoomForm } from "./create-room-form";

// The form takes no props. Its errors are reached by submitting; each is shown in the Messages section of the
// ui-kit page, at the width of the slot it appears in.
const states: UiStates = [{ name: "empty", render: () => <CreateRoomForm /> }];
export default states;
