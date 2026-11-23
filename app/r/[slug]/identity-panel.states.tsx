import type { UiStates } from "@/components/ui-kit";
import { ROOM } from "@/app/dev/ui-kit/samples";
import { IdentityPanel } from "./identity-panel";

const states: UiStates = [
  { name: "anyone can join", render: () => <IdentityPanel roomId={ROOM.roomId} slug={ROOM.slug} name="Anna" joinRule="ANYONE" /> },
  {
    name: "listed names only, long name",
    render: () => <IdentityPanel roomId={ROOM.roomId} slug={ROOM.slug} name="Chiara-Maria Fernández-Oyelaran" joinRule="LISTED_ONLY" />,
  },
];
export default states;
