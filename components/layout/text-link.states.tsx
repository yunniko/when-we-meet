import type { UiStates } from "@/components/ui-kit";
import { TextLink } from "./text-link";

const states: UiStates = [
  { name: "accent", render: () => <TextLink href="#">Next →</TextLink> },
  {
    name: "accent, small",
    render: () => (
      <TextLink href="#" size="sm">
        See results →
      </TextLink>
    ),
  },
  {
    name: "muted, extra small (footer)",
    render: () => (
      <TextLink href="#" tone="muted" size="xs">
        About, Terms & Privacy
      </TextLink>
    ),
  },
];
export default states;
