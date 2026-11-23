import type { UiStates } from "@/components/ui-kit";
import { LocaleSwitcher } from "./locale-switcher";

const states: UiStates = [{ name: "as the header shows it", render: () => <LocaleSwitcher /> }];
export default states;
