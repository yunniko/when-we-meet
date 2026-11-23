"use client";

import { useRouter } from "next/navigation";
import { useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { selectFinalSlot } from "@/app/r/[slug]/actions";
import { formatDayLabel, formatHour, isWeekend, slotKey } from "@/lib/slots";
import type { SlotResult } from "@/lib/results";
import { reserveFor } from "@/lib/message-slots";
import { Button, EmptyState, StatusSlot } from "@/components/ui-kit";

function cellStyle(result: SlotResult): CSSProperties {
  // A solid-color "image" layer (not backgroundColor) so the weekend shade
  // set via className (see cell below) can show through underneath at low
  // intensity instead of being clobbered by an inline background-color.
  const intensity = result.totalParticipants > 0 ? result.canCount / result.totalParticipants : 0;
  const c = `color-mix(in srgb, var(--color-can) ${(intensity * 100).toFixed(1)}%, transparent)`;
  return { backgroundImage: `linear-gradient(${c}, ${c})` };
}

export function ResultsBoard({
  roomId,
  slug,
  dates,
  hours,
  results,
  topResults,
  canPick,
}: {
  roomId: string;
  slug: string;
  dates: string[];
  hours: number[];
  results: SlotResult[];
  topResults: SlotResult[];
  canPick: boolean;
}) {
  const t = useTranslations("ResultsBoard");
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultByKey = new Map(results.map((r) => [slotKey(r.date, r.hour), r]));

  async function pick(date: string, hour: number) {
    const key = slotKey(date, hour);
    setPendingKey(key);
    setError(null);
    const res = await selectFinalSlot({ roomId, slug }, date, hour);
    if (!res.ok) setError(res.error);
    setPendingKey(null);
    router.refresh();
  }

  return (
    <>
      <StatusSlot
        message={error ? t(`errors.${error}`) : null}
        tone="danger"
        reserve={reserveFor(t, "ResultsBoard", "pick")}
        className="mb-2"
      />

      <div className="mb-6 flex flex-wrap items-center gap-4 text-xs text-text-muted">
        <span className="flex items-center gap-1.5">
          <span
            className="size-3 rounded-sm border border-border"
            style={{ backgroundColor: "color-mix(in srgb, var(--color-can) 15%, transparent)" }}
          />
          {t("legend.fewerCan")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-can" />
          {t("legend.moreCan")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm ring-2 ring-highlight" />
          {t("legend.everyoneCan")}
        </span>
        <span className="flex items-center gap-1.5">{t("legend.prefer")}</span>
        {canPick && <span className="font-medium text-accent">{t("legend.clickToPick")}</span>}
      </div>

      {/* Focusable so a keyboard can scroll it when no slot button is inside (a viewer who can't pick). */}
      <div
        role="region"
        aria-label={t("gridLabel")}
        tabIndex={0}
        className="max-h-[70vh] overflow-auto rounded-md border border-border focus-visible:outline-2 focus-visible:outline-focus"
      >
        <div className="inline-grid select-none" style={{ gridTemplateColumns: `72px repeat(${dates.length}, minmax(56px, 1fr))` }}>
          <div className="sticky left-0 top-0 z-20 border-b border-r border-border bg-surface" />
          {dates.map((date) => (
            <div
              key={date}
              className={`sticky top-0 z-10 border-b border-l border-border px-1 py-2 text-center text-xs font-medium ${
                isWeekend(date) ? "bg-weekend" : "bg-surface"
              }`}
            >
              {formatDayLabel(date)}
            </div>
          ))}

          {hours.map((hour) => (
            <div key={`row-${hour}`} className="contents">
              <div className="sticky left-0 z-10 border-r border-t border-border bg-surface px-2 py-1.5 text-right text-xs text-text-muted">
                {formatHour(hour)}
              </div>
              {dates.map((date) => {
                const key = slotKey(date, hour);
                const result = resultByKey.get(key);
                if (!result) return <div key={key} className="h-10 border-l border-t border-border" />;
                // ui-kit-allow: a heat-map cell; its colour is the result itself, not a button look.
                return (
                  <button
                    key={key}
                    type="button"
                    data-testid={`result-slot-${date}-${hour}`}
                    disabled={!canPick || pendingKey !== null}
                    onClick={() => pick(date, hour)}
                    title={`${t("cellTitleBase", { can: result.canCount, total: result.totalParticipants })}${
                      result.preferredCount > 0 ? t("cellTitlePrefer", { count: result.preferredCount }) : ""
                    }${result.cannotCount > 0 ? t("cellTitleCannot", { count: result.cannotCount }) : ""}`}
                    style={cellStyle(result)}
                    className={`relative h-10 border-l border-t border-border ${
                      isWeekend(date) ? "bg-weekend" : ""
                    } ${result.isFullGroup ? "ring-2 ring-inset ring-highlight" : ""} ${
                      canPick ? "cursor-pointer hover:ring-2 hover:ring-accent" : ""
                    } ${pendingKey === key ? "opacity-50" : ""}`}
                  >
                    {result.preferredCount > 0 && (
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-2xs font-medium text-on-can">
                        ★{result.preferredCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <h2 className="mt-8 mb-3 text-sm font-semibold">{t("bestTimesHeading")}</h2>
      {topResults.length === 0 ? (
        <EmptyState title={t("slotsEmpty")} className="items-start p-0 text-left" />
      ) : (
        <ol className="flex flex-col gap-1.5 text-sm">
          {topResults.map((r) => {
            const key = slotKey(r.date, r.hour);
            return (
              <li key={key} className="flex flex-col gap-1 rounded-md border border-border px-3 py-2">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <span>
                    {formatDayLabel(r.date)}, {formatHour(r.hour)}–{formatHour((r.hour + 1) % 24)}
                  </span>
                  <span className="flex flex-wrap items-center gap-2 text-text-muted">
                    {t("cellTitleBase", { can: r.canCount, total: r.totalParticipants })}
                    {r.isFullGroup && (
                      <span className="rounded-full bg-highlight/20 px-1.5 py-0.5 text-xs font-medium text-warning">
                        {t("everyoneBadge")}
                      </span>
                    )}
                    {r.preferredCount > 0 && t("preferSuffix", { count: r.preferredCount })}
                    {canPick && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="ml-1"
                        busy={pendingKey === key}
                        busyLabel={t("settingButton")}
                        disabled={pendingKey !== null && pendingKey !== key}
                        onClick={() => pick(r.date, r.hour)}
                      >
                        {t("pickButton")}
                      </Button>
                    )}
                  </span>
                </div>
                {r.missingNames.length > 0 && (
                  <p className="text-xs text-text-muted">{t("cantLabel", { names: r.missingNames.join(", ") })}</p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
