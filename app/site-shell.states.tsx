import type { UiStates } from "@/components/ui-kit";
import { SiteShell } from "./site-shell";

const states: UiStates = [{ name: "around a page", render: () => <SiteShell>The page goes here</SiteShell> }];
export default states;
