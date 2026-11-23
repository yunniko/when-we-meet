import type { UiStates } from "@/components/ui-kit";
import { setLocaleAction } from "@/lib/locale-actions";
import { localeDisplayName } from "@/lib/ui-locales";
import { LocaleSelect } from "./locale-select";

const options = ["en", "cs", "de", "ru"].map((code) => ({ code, label: localeDisplayName(code) }));

const states: UiStates = [
  { name: "English selected", render: () => <LocaleSelect current="en" options={options} action={setLocaleAction} label="Language" /> },
];
export default states;
