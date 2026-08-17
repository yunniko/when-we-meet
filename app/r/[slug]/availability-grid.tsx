"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { saveAvailability, type SlotUpdate } from "@/app/r/[slug]/actions";
import { formatDayLabel, formatHour, slotKey, type SlotStatus } from "@/lib/slots";

type Brush = SlotStatus | "CLEAR";

const BRUSHES: { value: Brush; label: string; swatchClass: string }[] = [
  { value: "CAN", label: "Can", swatchClass: "bg-emerald-500" },
  { value: "CANNOT", label: "Can't", swatchClass: "bg-rose-500" },
  { value: "CLEAR", label: "Clear", swatchClass: "bg-transparent border border-black/30 dark:border-white/30" },
];

function cellClass(status: SlotStatus | undefined): string {
  if (status === "CAN") return "bg-emerald-500/80 hover:bg-emerald-500";
  if (status === "CANNOT") return "bg-rose-500/70 hover:bg-rose-500/90";
  return "bg-black/[.03] hover:bg-black/[.08] dark:bg-white/[.04] dark:hover:bg-white/[.1]";
}

export function AvailabilityGrid({
  roomId,
  dates,
  hours,
  initialAvailability,
}: {
  roomId: string;
  dates: string[];
  hours: number[];
  initialAvailability: Record<string, SlotStatus>;
}) {
  const [marks, setMarks] = useState<Record<string, SlotStatus>>(initialAvailability);
  const [brush, setBrush] = useState<Brush>("CAN");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const painting = useRef(false);
  const strokeChanges = useRef<Map<string, SlotUpdate>>(new Map());
  // Last (dateIndex, hourIndex) painted during the current stroke, so a fast
  // drag/swipe that skips pointerenter events on intermediate cells (common
  // on touch, and even with a fast mouse) still fills the gap in between.
  const lastPaintedIndex = useRef<{ dateIdx: number; hourIdx: number } | null>(null);

  const paintCell = useCallback(
    (date: string, hour: number) => {
      const key = slotKey(date, hour);
      setMarks((prev) => {
        const next = { ...prev };
        if (brush === "CLEAR") delete next[key];
        else next[key] = brush;
        return next;
      });
      strokeChanges.current.set(key, {
        date,
        hour,
        status: brush === "CLEAR" ? null : brush,
      });
    },
    [brush],
  );

  const paintCellAtIndex = useCallback(
    (dateIdx: number, hourIdx: number) => {
      const last = lastPaintedIndex.current;
      if (last) {
        // Fill every grid cell on the straight line from the last painted
        // cell to this one (steps along whichever axis moved further).
        const dSteps = dateIdx - last.dateIdx;
        const hSteps = hourIdx - last.hourIdx;
        const steps = Math.max(Math.abs(dSteps), Math.abs(hSteps));
        for (let i = 1; i <= steps; i++) {
          const d = last.dateIdx + Math.round((dSteps * i) / steps);
          const h = last.hourIdx + Math.round((hSteps * i) / steps);
          paintCell(dates[d], hours[h]);
        }
      } else {
        paintCell(dates[dateIdx], hours[hourIdx]);
      }
      lastPaintedIndex.current = { dateIdx, hourIdx };
    },
    [dates, hours, paintCell],
  );

  const endStroke = useCallback(() => {
    if (!painting.current) return;
    painting.current = false;
    lastPaintedIndex.current = null;
    const changes = [...strokeChanges.current.values()];
    strokeChanges.current.clear();
    if (changes.length === 0) return;
    setSaveState("saving");
    saveAvailability(roomId, changes)
      .then((res) => setSaveState(res.ok ? "saved" : "error"))
      .catch(() => setSaveState("error"));
  }, [roomId]);

  useEffect(() => {
    if (saveState !== "saved") return;
    const t = setTimeout(() => setSaveState("idle"), 1500);
    return () => clearTimeout(t);
  }, [saveState]);

  useEffect(() => {
    function handleUp() {
      endStroke();
    }
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [endStroke]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex gap-1.5">
          {BRUSHES.map((b) => (
            <button
              key={b.value}
              type="button"
              onClick={() => setBrush(b.value)}
              aria-pressed={brush === b.value}
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                brush === b.value
                  ? "border-foreground"
                  : "border-black/10 dark:border-white/15"
              }`}
            >
              <span className={`size-3 rounded-sm ${b.swatchClass}`} />
              {b.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-foreground/50">
          {saveState === "saving" && "Saving…"}
          {saveState === "saved" && "Saved"}
          {saveState === "error" && "Couldn't save — try again"}
        </span>
      </div>

      <p className="text-xs text-foreground/50">
        Click, or click and drag, to paint slots. Works with touch too.
      </p>

      <div className="overflow-x-auto rounded-md border border-black/10 dark:border-white/15">
        <div
          className="inline-grid select-none"
          style={{
            gridTemplateColumns: `72px repeat(${dates.length}, minmax(56px, 1fr))`,
            touchAction: "none",
          }}
        >
          <div className="sticky left-0 top-0 z-20 border-b border-r border-black/10 bg-background dark:border-white/15" />
          {dates.map((date) => (
            <div
              key={date}
              className="sticky top-0 z-10 border-b border-l border-black/10 bg-background px-1 py-2 text-center text-xs font-medium dark:border-white/15"
            >
              {formatDayLabel(date)}
            </div>
          ))}

          {hours.map((hour, hourIdx) => (
            <Fragment key={`h-${hour}`}>
              <div className="sticky left-0 z-10 border-r border-t border-black/10 bg-background px-2 py-1.5 text-right text-xs text-foreground/60 dark:border-white/15">
                {formatHour(hour)}
              </div>
              {dates.map((date, dateIdx) => {
                const key = slotKey(date, hour);
                const status = marks[key];
                return (
                  <div
                    key={key}
                    onPointerDown={(e) => {
                      e.currentTarget.releasePointerCapture(e.pointerId);
                      painting.current = true;
                      lastPaintedIndex.current = null;
                      paintCellAtIndex(dateIdx, hourIdx);
                    }}
                    onPointerEnter={() => {
                      if (painting.current) paintCellAtIndex(dateIdx, hourIdx);
                    }}
                    className={`h-8 border-l border-t border-black/10 dark:border-white/15 ${cellClass(status)}`}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
