"use client";

import {
  useActionState,
  useEffect,
  useLayoutEffect,
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useTranslations } from "next-intl";
import { createRoom, type CreateRoomState } from "@/app/actions";
import { DAILY_PRESETS, type DailyPresetKey } from "@/lib/room-presets";
import { formatHoursWindow } from "@/lib/slots";
import { pickGuessedTimezone } from "@/lib/timezone-guess";

const inputClass =
  "rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent";

const PRESET_KEYS: DailyPresetKey[] = ["evening", "wholeDay", "morning", "midday", "custom"];

const LAST_TIMEZONE_STORAGE_KEY = "wwm_last_timezone";

// The guess only ever runs client-side (see the effect in CreateRoomForm)
// because a server has no idea what timezone the visitor is in — guessing
// during SSR would just report the *server's* timezone. This component is
// still server-rendered on first request (it's a plain client component,
// not dynamic-imported with ssr:false), so touching Intl/localStorage
// anywhere in the render body — including a useState initializer — runs on
// the server too and produces a value the client then has to silently
// overwrite after hydration. That overwrite used to be racy (an
// uncontrolled <select> keyed off `defaultValue`, which React only applies
// once at mount), which is why the guess sometimes never appeared at all,
// especially on slower devices: whichever value was on-screen when the
// user first looked at the field is what stuck. The select is controlled
// now specifically so a post-mount guess reliably updates it.
//
// useLayoutEffect (rather than useEffect) so the guess is applied before
// the browser paints — no flash of the wrong zone. It's a no-op during SSR
// (guarded below) since React warns if it's called there.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

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

// The region-qualified version shown in the collapsed info label — plain
// `timezoneLabel` on its own (e.g. "Prague") drops the region, which reads
// fine inside a grouped <select> but is ambiguous standing alone next to a
// "Change" button.
function fullTimezoneLabel(zone: string): string {
  if (!zone.includes("/")) return zone;
  return `${zone.split("/")[0]} / ${timezoneLabel(zone)}`;
}

const initialState: CreateRoomState = {
  values: {
    title: "",
    description: "",
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
  const [timezone, setTimezone] = useState(() => state.values.timezone || "");
  const zoneGroups = groupedTimezoneOptions();

  // Runs once, client-only, after the zone list above is available. Skips
  // guessing entirely if a value is already present (a resubmitted value
  // from a failed validation, or — in principle — a future prefill source)
  // so we never clobber something the user already chose.
  useIsomorphicLayoutEffect(() => {
    if (timezone) return;
    let intlZone: string | null = null;
    try {
      intlZone = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch {
      intlZone = null;
    }
    let rememberedZone: string | null = null;
    try {
      rememberedZone = localStorage.getItem(LAST_TIMEZONE_STORAGE_KEY);
    } catch {
      rememberedZone = null;
    }
    const offsetMinutes = new Date().getTimezoneOffset();
    const supportedZones = new Set(zoneGroups.flatMap((g) => g.zones));
    setTimezone(pickGuessedTimezone({ intlZone, rememberedZone, offsetMinutes, supportedZones }));
    // Deliberately mount-only: `timezone` is read only to bail out if a
    // value's already present, and zoneGroups is recomputed every render
    // from a pure global (Intl's supported zones) that never actually
    // changes — depending on either would just re-run this pointlessly.
  }, []);

  // Default view is a compact "Prague — Change" label, not the raw
  // <select>, so the form doesn't lead with a ~400-option dropdown when the
  // guess is almost always already right. "Change" swaps to the <select>;
  // picking a value there swaps straight back to the label (the Owner's
  // requested flow) rather than leaving the dropdown open after a choice.
  const [isEditingTimezone, setIsEditingTimezone] = useState(false);

  function handleTimezoneChange(event: ChangeEvent<HTMLSelectElement>) {
    const zone = event.target.value;
    setTimezone(zone);
    setIsEditingTimezone(false);
    try {
      localStorage.setItem(LAST_TIMEZONE_STORAGE_KEY, zone);
    } catch {
      // Private browsing / storage disabled — the choice just won't be
      // remembered for next time, which is fine, not fatal.
    }
  }

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

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-medium">
          {t("descriptionLabel")} <span className="text-muted">{t("optional")}</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={2000}
          defaultValue={state.values.description}
          placeholder={t("descriptionPlaceholder")}
          className={`${inputClass} resize-y`}
        />
        {fieldError("description") && (
          <p className="text-xs text-red-600">{fieldError("description")}</p>
        )}
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
        {/* The actual submitted value always comes from this hidden input,
            regardless of which view below is showing — the <select> (when
            open) is deliberately unnamed so it never double-submits. */}
        <input type="hidden" name="timezone" value={timezone} />
        {isEditingTimezone ? (
          <select
            id="timezone"
            required
            autoFocus
            value={timezone}
            onChange={handleTimezoneChange}
            className={inputClass}
          >
            {!timezone && (
              <option value="" disabled hidden>
                {t("timezoneDetecting")}
              </option>
            )}
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
        ) : (
          <div
            id="timezone"
            className={`${inputClass} flex items-center justify-between gap-3`}
          >
            <span>{timezone ? fullTimezoneLabel(timezone) : t("timezoneDetecting")}</span>
            <button
              type="button"
              onClick={() => setIsEditingTimezone(true)}
              className="shrink-0 text-xs font-medium text-accent underline hover:text-accent-hover"
            >
              {t("timezoneChange")}
            </button>
          </div>
        )}
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
