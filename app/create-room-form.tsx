"use client";

import { useActionState, useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { createRoom, type CreateRoomState } from "@/app/actions";
import { DAILY_PRESETS, type DailyPresetKey } from "@/lib/room-presets";
import { formatHoursWindow } from "@/lib/slots";

const inputClass =
  "rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent";

const PRESET_KEYS: DailyPresetKey[] = ["evening", "wholeDay", "morning", "midday", "custom"];

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
  const t = useTranslations("CreateRoom");
  const [state, formAction] = useActionState(
    createRoom,
    initialState,
  );
  const [isPending, startTransition] = useTransition();
  const [timezone] = useState(() => state.values.timezone || guessTimezone());
  const zoneGroups = groupedTimezoneOptions();
  const [preset, setPreset] = useState<DailyPresetKey>("evening");
  const showCustom = preset === "custom";
  const fieldError = (field: string) =>
    state.fieldErrors?.[field] ? t(`errors.${state.fieldErrors[field]}`) : null;

  // Only the preset's name is translated; the "(17:00–22:00)" part is
  // locale-invariant digits built from the same formatter the room/results
  // pages already use, not a separate translated literal per language.
  const presetOptions = PRESET_KEYS.map((key) => ({
    value: key,
    label:
      key === "custom"
        ? t("presets.custom")
        : `${t(`presets.${key}`)} (${formatHoursWindow(DAILY_PRESETS[key].start, DAILY_PRESETS[key].end)})`,
  }));

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
          {t(`errors.${state.error}`)}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-sm font-medium">
          {t("roomNameLabel")} <span className="text-muted">{t("optional")}</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          maxLength={120}
          defaultValue={state.values.title}
          placeholder={t("roomNamePlaceholder")}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="startDate" className="text-sm font-medium">
            {t("fromLabel")}
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            required
            defaultValue={state.values.startDate}
            className={inputClass}
          />
          {fieldError("startDate") && (
            <p className="text-xs text-red-600">{fieldError("startDate")}</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="endDate" className="text-sm font-medium">
            {t("toLabel")}
          </label>
          <input
            id="endDate"
            name="endDate"
            type="date"
            required
            defaultValue={state.values.endDate}
            className={inputClass}
          />
          {fieldError("endDate") && (
            <p className="text-xs text-red-600">{fieldError("endDate")}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="timezone" className="text-sm font-medium">
          {t("timezoneLabel")}
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
        <p className="text-xs text-muted">{t("timezoneHelp")}</p>
        {fieldError("timezone") && (
          <p className="text-xs text-red-600">{fieldError("timezone")}</p>
        )}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t("dailyWindowLegend")}</legend>
        {presetOptions.map((p) => (
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
                {t("dailyStartLabel")}
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
                {t("dailyEndLabel")}
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
        {fieldError("dayEndHour") && (
          <p className="text-xs text-red-600">{fieldError("dayEndHour")}</p>
        )}
      </fieldset>

      <button
        type="submit"
        disabled={isPending}
        className="mt-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
