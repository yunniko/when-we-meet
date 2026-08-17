"use client";

import { useRouter } from "next/navigation";
import { useState, type CSSProperties } from "react";
import { selectFinalSlot } from "@/app/r/[slug]/actions";
import { formatDayLabel, formatHour, isWeekend, slotKey } from "@/lib/slots";
import type { SlotResult } from "@/lib/results";

function cellStyle(result: SlotResult): CSSProperties {
  // A solid-color "image" layer (not backgroundColor) so the weekend shade
  // set via className (see cell below) can show through underneath at low
  // intensity instead of being clobbered by an inline background-color.
  const intensity = result.totalParticipants > 0 ? result.canCount / result.totalParticipants : 0;
  const c = `rgba(16, 185, 129, ${intensity.toFixed(3)})`;
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
      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm border border-border" style={{ backgroundColor: "rgba(16,185,129,0.15)" }} />
          fewer can
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm" style={{ backgroundColor: "rgba(16,185,129,1)" }} />
          more can
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm ring-2 ring-amber-400" />
          everyone can
        </span>
        <span className="flex items-center gap-1.5">★N = N prefer this slot</span>
        {canPick && <span className="font-medium text-accent">Click a slot to set it as the meeting time</span>}
      </div>

      <div className="max-h-[70vh] overflow-auto rounded-md border border-border">
        <div
          className="inline-grid select-none"
          style={{ gridTemplateColumns: `72px repeat(${dates.length}, minmax(56px, 1fr))` }}
        >
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
              <div className="sticky left-0 z-10 border-r border-t border-border bg-surface px-2 py-1.5 text-right text-xs text-muted">
                {formatHour(hour)}
              </div>
              {dates.map((date) => {
                const key = slotKey(date, hour);
                const result = resultByKey.get(key);
                if (!result) return <div key={key} className="h-10 border-l border-t border-border" />;
                return (
                  <button
                    key={key}
                    type="button"
                    data-testid={`result-slot-${date}-${hour}`}
                    disabled={!canPick || pendingKey !== null}
                    onClick={() => pick(date, hour)}
                    title={`${result.canCount}/${result.totalParticipants} can${
                      result.preferredCount > 0 ? `, ${result.preferredCount} prefer` : ""
                    }${result.cannotCount > 0 ? `, ${result.cannotCount} can't` : ""}`}
                    style={cellStyle(result)}
                    className={`relative h-10 border-l border-t border-border ${
                      isWeekend(date) ? "bg-weekend" : ""
                    } ${result.isFullGroup ? "ring-2 ring-inset ring-amber-400" : ""} ${
                      canPick ? "cursor-pointer hover:ring-2 hover:ring-accent" : ""
                    } ${pendingKey === key ? "opacity-50" : ""}`}
                  >
                    {result.preferredCount > 0 && (
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-medium text-emerald-950">
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

      <h2 className="mt-8 mb-3 text-sm font-semibold">Best times</h2>
      {topResults.length === 0 ? (
        <p className="text-sm text-muted">Nobody has marked any slots as available yet.</p>
      ) : (
        <ol className="flex flex-col gap-1.5 text-sm">
          {topResults.map((r) => {
            const key = slotKey(r.date, r.hour);
            return (
              <li key={key} className="flex flex-col gap-1 rounded-md border border-border px-3 py-2">
                <div className="flex items-center justify-between gap-4">
                  <span>
                    {formatDayLabel(r.date)}, {formatHour(r.hour)}–{formatHour((r.hour + 1) % 24)}
                  </span>
                  <span className="flex items-center gap-2 text-muted">
                    {r.canCount}/{r.totalParticipants} can
                    {r.isFullGroup && (
                      <span className="rounded-full bg-amber-400/20 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                        everyone
                      </span>
                    )}
                    {r.preferredCount > 0 && ` · ★${r.preferredCount} prefer`}
                    {canPick && (
                      <button
                        type="button"
                        disabled={pendingKey !== null}
                        onClick={() => pick(r.date, r.hour)}
                        className="ml-1 rounded-md border border-accent px-2 py-1 text-xs font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
                      >
                        {pendingKey === key ? "Setting…" : "Pick this time"}
                      </button>
                    )}
                  </span>
                </div>
                {r.missingNames.length > 0 && (
                  <p className="text-xs text-muted">
                    Can&apos;t: {r.missingNames.join(", ")}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
