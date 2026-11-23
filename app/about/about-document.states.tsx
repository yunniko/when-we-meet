import type { UiStates } from "@/components/ui-kit";
import { AboutDocument } from "./about-document";

const states: UiStates = [{ name: "the current draft", render: () => <AboutDocument /> }];
export default states;
