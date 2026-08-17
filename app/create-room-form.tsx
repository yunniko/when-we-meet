"use client";

import { useActionState, useState, useTransition, type FormEvent } from "react";
import { createRoom, type CreateRoomState } from "@/app/actions";
import { DAILY_PRESETS, type DailyPresetKey } from "@/lib/room-presets";

const inputClass =
  "rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent";

function guessTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

// Grouped by region (the part before the first "/") so the <select> is
// scannable instead of one flat alphabetical list of ~400 entries.
function groupedTimezoneOptions(): { region: string; zones: string[] }[] {
  let zones: string[];
  try {
    zones = Intl.supportedValuesOf("timeZone");
  } catch {
    zones = ["UTC"];
  }
  const groups = new Map<string, string[]>();
  for (const zone of zones) {
    const region = zone.includes("/") ? zone.split("/")[0] : "Other";
    const list = groups.get(region) ?? [];
    list.push(zone);
    groups.set(region, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([region, list]) => ({ region, zones: list.sort() }));
}

function timezoneLabel(zone: string): string {
  return zone.slice(zone.indexOf("/") + 1).replaceAll("_", " ").replaceAll("/", " / ");
}

const PRESET_OPTIONS: { value: DailyPresetKey; label: string }[] = [
  ...Object.entries(DAILY_PRESETS).map(([value, p]) => ({
    value: value as DailyPresetKey,
    label: p.label,
  })),
  { value: "custom", label: "Custom range" },
];

const initialState: CreateRoomState = {
  values: {
    title: "",
    timezone: "",
    startDate: "",
    endDate: "",
    dayStartHour: "17",
    dayEndHour: "22",
  },
};

export function CreateRoomForm() {
  const [state, formAction] = useActionState(
    createRoom,
    initialState,
  );
  const [isPending, startTransition] = useTransition();
  const [timezone] = useState(() => state.values.timezone || guessTimezone());
  const zoneGroups = groupedTimezoneOptions();
  const [preset, setPreset] = useState<DailyPresetKey>("evening");
  const showCustom = preset === "custom";

  // Submitting via <form action={formAction}> (native form submission) is
  // what triggers React 19's automatic post-action form reset — and that
  // reset mutates radio/checkbox `checked` via the raw DOM (each control's
  // defaultChecked attribute, frozen at mount) rather than through React,
  // so it desyncs from a controlled `checked` prop and React's reconciler
  // doesn't always notice/repair it on the next render. Dispatching the
  // action ourselves, outside the form's native action wiring, sidesteps
  // that reset path entirely — nothing here ever calls the real
  // HTMLFormElement.reset().
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => {
      formAction(data);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-sm font-medium">
          Room name <span className="text-muted">(optional)</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          maxLength={120}
          defaultValue={state.values.title}
          placeholder="e.g. Camping trip"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="startDate" className="text-sm font-medium">
            From
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            required
            defaultValue={state.values.startDate}
            className={inputClass}
          />
          {state.fieldErrors?.startDate && (
            <p className="text-xs text-red-600">
              {state.fieldErrors.startDate}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="endDate" className="text-sm font-medium">
            To
          </label>
          <input
            id="endDate"
            name="endDate"
            type="date"
            required
            defaultValue={state.values.endDate}
            className={inputClass}
          />
          {state.fieldErrors?.endDate && (
            <p className="text-xs text-red-600">
              {state.fieldErrors.endDate}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="timezone" className="text-sm font-medium">
          Timezone
        </label>
        <select
          id="timezone"
          name="timezone"
          defaultValue={timezone}
          className={inputClass}
        >
          {zoneGroups.map(({ region, zones }) => (
            <optgroup key={region} label={region}>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {timezoneLabel(z)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <p className="text-xs text-muted">
          Everyone in this room marks and sees times in this single timezone.
        </p>
        {state.fieldErrors?.timezone && (
          <p className="text-xs text-red-600">
            {state.fieldErrors.timezone}
          </p>
        )}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Daily time window</legend>
        {PRESET_OPTIONS.map((p) => (
          <label key={p.value} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="preset"
              value={p.value}
              checked={preset === p.value}
              onChange={() => setPreset(p.value)}
              className="size-4 accent-accent"
            />
            {p.label}
          </label>
        ))}
        {showCustom && (
          <div className="grid grid-cols-2 gap-4 pl-6">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="dayStartHour" className="text-xs">
                Daily start
              </label>
              <input
                id="dayStartHour"
                name="dayStartHour"
                type="number"
                min={0}
                max={23}
                defaultValue={state.values.dayStartHour}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="dayEndHour" className="text-xs">
                Daily end
              </label>
              <input
                id="dayEndHour"
                name="dayEndHour"
                type="number"
                min={1}
                max={24}
                defaultValue={state.values.dayEndHour}
                className={inputClass}
              />
            </div>
          </div>
        )}
        {state.fieldErrors?.dayEndHour && (
          <p className="text-xs text-red-600">
            {state.fieldErrors.dayEndHour}
          </p>
        )}
      </fieldset>

      <button
        type="submit"
        disabled={isPending}
        className="mt-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? "Creating…" : "Create room & get link"}
      </button>
    </form>
  );
}
