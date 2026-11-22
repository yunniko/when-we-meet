"use client";

import { useActionState, useEffect, useLayoutEffect, useRef, useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { createRoom, type CreateRoomState } from "@/app/actions";
import { DAILY_PRESETS, type DailyPresetKey } from "@/lib/room-presets";
import { formatHoursWindow } from "@/lib/slots";
import { pickGuessedTimezone } from "@/lib/timezone-guess";
import { reserveFor } from "@/lib/message-slots";
import { MAX_DESCRIPTION_LENGTH } from "@/lib/validation";
import { Button, Choice, Field, FieldGroup, StatusSlot, controlClass } from "@/components/ui-kit";

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
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([region, list]) => ({ region, zones: list.sort() }));
}

function timezoneLabel(zone: string): string {
  return zone
    .slice(zone.indexOf("/") + 1)
    .replaceAll("_", " ")
    .replaceAll("/", " / ");
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
    invitedNames: "",
    joinRule: "ANYONE",
  },
};

export function CreateRoomForm() {
  const t = useTranslations("CreateRoom");
  const [state, formAction] = useActionState(createRoom, initialState);
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
  const [joinRule, setJoinRule] = useState<"ANYONE" | "LISTED_ONLY">("ANYONE");
  const showCustom = preset === "custom";
  const fieldError = (field: string) => (state.fieldErrors?.[field] ? t(`errors.${state.fieldErrors[field]}`) : null);

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

  // After a refused submit, focus the first field with an error, so the summary beside the button and the
  // field's own message point at the same place.
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state.fieldErrors) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);

  const optional = <span className="text-text-muted">{t("optional")}</span>;

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Field
        label={
          <>
            {t("roomNameLabel")} {optional}
          </>
        }
      >
        {(p) => (
          <input
            {...p}
            name="title"
            type="text"
            maxLength={120}
            defaultValue={state.values.title}
            placeholder={t("roomNamePlaceholder")}
            className={controlClass}
          />
        )}
      </Field>

      <Field
        label={
          <>
            {t("descriptionLabel")} {optional}
          </>
        }
        error={fieldError("description")}
      >
        {(p) => (
          <textarea
            {...p}
            name="description"
            rows={3}
            maxLength={MAX_DESCRIPTION_LENGTH}
            defaultValue={state.values.description}
            placeholder={t("descriptionPlaceholder")}
            className={`${controlClass} resize-y py-2`}
          />
        )}
      </Field>

      {/* One question, one message: the pair shares a full-width slot, so a date error never wraps in a half
          column and pushes the form down (found at 390px; see tests/e2e/ui-quality.spec.ts). */}
      <FieldGroup
        legend={t("datesLegend")}
        error={fieldError("startDate") ?? fieldError("endDate")}
        reserve={reserveFor(t, "CreateRoom", "dates")}
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label={t("fromLabel")}>
            {(p) => (
              <input
                {...p}
                aria-invalid={fieldError("startDate") ? true : undefined}
                name="startDate"
                type="date"
                required
                defaultValue={state.values.startDate}
                className={controlClass}
              />
            )}
          </Field>
          <Field label={t("toLabel")}>
            {(p) => (
              <input
                {...p}
                aria-invalid={fieldError("endDate") ? true : undefined}
                name="endDate"
                type="date"
                required
                defaultValue={state.values.endDate}
                className={controlClass}
              />
            )}
          </Field>
        </div>
      </FieldGroup>

      <Field
        label={t("timezoneLabel")}
        hint={t("timezoneHint")}
        error={fieldError("timezone")}
        reserve={reserveFor(t, "CreateRoom", "timezone")}
      >
        {(p) => (
          <>
            {/* The submitted value always comes from this hidden input, whichever view shows: the <select> is
                deliberately unnamed so it never double-submits. */}
            <input type="hidden" name="timezone" value={timezone} />
            {isEditingTimezone ? (
              <select {...p} required autoFocus value={timezone} onChange={handleTimezoneChange} className={controlClass}>
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
              <div {...p} className={`${controlClass} flex items-center justify-between gap-3`}>
                <span>{timezone ? fullTimezoneLabel(timezone) : t("timezoneDetecting")}</span>
                <button
                  type="button"
                  onClick={() => setIsEditingTimezone(true)}
                  className="-mr-2 min-h-11 shrink-0 px-2 text-sm font-medium text-accent underline hover:text-accent-hover"
                >
                  {t("timezoneChange")}
                </button>
              </div>
            )}
          </>
        )}
      </Field>

      <FieldGroup
        legend={t("dailyWindowLegend")}
        error={fieldError("dayStartHour") ?? fieldError("dayEndHour")}
        reserve={reserveFor(t, "CreateRoom", "dailyWindow")}
      >
        {presetOptions.map((p) => (
          <Choice key={p.value} type="radio" name="preset" value={p.value} checked={preset === p.value} onChange={() => setPreset(p.value)}>
            {p.label}
          </Choice>
        ))}
        {showCustom && (
          <div className="grid grid-cols-2 gap-4 pl-6">
            <Field label={t("dailyStartLabel")}>
              {(p) => (
                <input
                  {...p}
                  aria-invalid={fieldError("dayStartHour") ? true : undefined}
                  name="dayStartHour"
                  type="number"
                  required
                  min={0}
                  max={23}
                  defaultValue={state.values.dayStartHour}
                  className={controlClass}
                />
              )}
            </Field>
            <Field label={t("dailyEndLabel")}>
              {(p) => (
                <input
                  {...p}
                  aria-invalid={fieldError("dayEndHour") ? true : undefined}
                  name="dayEndHour"
                  type="number"
                  required
                  min={1}
                  max={24}
                  defaultValue={state.values.dayEndHour}
                  className={controlClass}
                />
              )}
            </Field>
          </div>
        )}
      </FieldGroup>

      <Field
        label={
          <>
            {t("invitedLabel")} {optional}
          </>
        }
        hint={t("invitedHint")}
        error={fieldError("invitedNames")}
        reserve={reserveFor(t, "CreateRoom", "invitedNames")}
      >
        {(p) => (
          <textarea
            {...p}
            name="invitedNames"
            rows={4}
            defaultValue={state.values.invitedNames}
            placeholder={t("invitedPlaceholder")}
            className={`${controlClass} resize-y py-2`}
          />
        )}
      </Field>

      <FieldGroup
        legend={t("joinRuleLegend")}
        hint={t("joinRuleHint")}
        error={fieldError("joinRule")}
        reserve={reserveFor(t, "CreateRoom", "joinRule")}
      >
        {(["ANYONE", "LISTED_ONLY"] as const).map((rule) => (
          <Choice key={rule} type="radio" name="joinRule" value={rule} checked={joinRule === rule} onChange={() => setJoinRule(rule)}>
            {rule === "ANYONE" ? t("joinRuleAnyone") : t("joinRuleListedOnly")}
          </Choice>
        ))}
      </FieldGroup>

      <div className="mt-2 flex flex-col gap-1">
        <Button type="submit" busy={isPending} busyLabel={t("submitting")}>
          {t("submit")}
        </Button>
        <StatusSlot message={state.error ? t(`errors.${state.error}`) : null} tone="danger" reserve={reserveFor(t, "CreateRoom", "form")} />
      </div>
    </form>
  );
}
