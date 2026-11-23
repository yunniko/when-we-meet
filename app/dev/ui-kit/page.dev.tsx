// The ui-kit page (COMPANY/UI_STANDARDS.md §2): only `next dev` serves `.dev.tsx` pages (next.config.ts), and
// `build:check` fails if the page reaches a production build. Nothing here is listed by hand: the kit draws its
// own components, the generated registry brings every component's `.states.tsx`, and the Messages section is
// MESSAGE_SLOTS, which a unit test keeps complete (ui-kit D010).
import { getTranslations } from "next-intl/server";
import { StatusSlot, ToastProvider } from "@/components/ui-kit";
import { KitchenSink } from "@/components/ui-kit/kitchen-sink";
import { StateFrame, renderSections } from "@/components/ui-kit/ui-page";
import { MESSAGE_SLOTS } from "@/lib/message-slots";
import { UI_PAGE_STATES } from "./registry";

// Values for every placeholder a message may carry, so each one renders as a person would read it.
const SAMPLE_VALUES = {
  name: "Anna",
  names: "Anna, Boris",
  count: 3,
  max: 20,
  total: 3,
  can: 2,
  cannot: 1,
  joined: 2,
  expected: "Anna",
  title: "Team dinner",
  when: "Sat 13 Mar, 19:00",
};

async function Messages() {
  const sections = await Promise.all(
    Object.entries(MESSAGE_SLOTS).map(async ([namespace, slots]) => {
      // Keys come from MESSAGE_SLOTS at runtime, so the typed translator is widened to plain strings here.
      const t = (await getTranslations(namespace)) as unknown as (key: string, values: typeof SAMPLE_VALUES) => string;
      return Object.entries(slots).map(([slot, keys]) => (
        <StateFrame key={`${namespace}.${slot}`} name={`${namespace} · ${slot}`}>
          <div className="flex flex-col gap-1">
            {(keys as readonly string[]).map((key) => (
              <StatusSlot key={key} message={t(key, SAMPLE_VALUES)} tone={key.startsWith("errors.") ? "danger" : "neutral"} />
            ))}
          </div>
        </StateFrame>
      ));
    })
  );
  return (
    <section id="messages" className="flex flex-col gap-3 rounded-md border border-border bg-surface-raised p-4">
      <h2 className="m-0 text-lg">Messages</h2>
      {sections.flat()}
    </section>
  );
}

export default function UiKitPage() {
  return (
    <ToastProvider dismissLabel="Dismiss">
      <KitchenSink sections={renderSections(UI_PAGE_STATES)}>
        <Messages />
      </KitchenSink>
    </ToastProvider>
  );
}
