"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { saveAvailability } from "@/app/r/[slug]/actions";
import {
  applyBrush,
  cellsBetween,
  preferStrokeSets,
  type Brush,
  type CellIndex,
  type Marks,
  type SlotUpdate,
} from "@/lib/paint";
import { formatDayLabel, formatHour, isWeekend, slotKey, type CellMark } from "@/lib/slots";

const BRUSH_KEYS: { value: Brush; swatchClass: string }[] = [
  { value: "CAN", swatchClass: "bg-emerald-500" },
  { value: "CANNOT", swatchClass: "bg-rose-500" },
  { value: "PREFER", swatchClass: "bg-amber-400" },
  { value: "CLEAR", swatchClass: "bg-transparent border border-muted" },
];

const BRUSH_LABEL_KEYS: Record<Brush, string> = {
  CAN: "can",
  CANNOT: "cannot",
  PREFER: "prefer",
  CLEAR: "clear",
};

// A finger landing on a cell may be about to scroll the grid or about to
// paint it. Holding still for this long commits to painting; moving further
// than the slop before that lets the browser scroll instead. A lift before
// either is a tap and paints that one cell. Mouse and pen paint at once.
// See D009.
const TOUCH_HOLD_MS = 250;
const TOUCH_SLOP_PX = 8;

function cellClass(mark: CellMark | undefined, weekend: boolean): string {
  if (mark?.status === "CAN") return "bg-emerald-500/80 hover:bg-emerald-500";
  if (mark?.status === "CANNOT") return "bg-rose-500/70 hover:bg-rose-500/90";
  return weekend
    ? "bg-weekend hover:bg-foreground/[.07]"
    : "bg-foreground/[.03] hover:bg-foreground/[.07]";
}

function cellAt(x: number, y: number): CellIndex | null {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-date-idx]");
  if (!el) return null;
  return { dateIdx: Number(el.dataset.dateIdx), hourIdx: Number(el.dataset.hourIdx) };
}

export function AvailabilityGrid({
  roomId,
  participantId,
  dates,
  hours,
  initialAvailability,
}: {
  roomId: string;
  // The participant this grid was rendered for; the save refuses to write
  // as anyone else (identity can change in another tab, see G-003).
  participantId: string;
  dates: string[];
  hours: number[];
  initialAvailability: Record<string, CellMark>;
}) {
  const t = useTranslations("AvailabilityGrid");
  const router = useRouter();
  const [marks, setMarks] = useState<Marks>(initialAvailability);
  const [brush, setBrush] = useState<Brush>("CAN");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error" | "removed">(
    "idle",
  );
  const gridRef = useRef<HTMLDivElement>(null);
  // Mirror of `marks` for event handlers, so a stroke reads its own earlier
  // cells without waiting for a render.
  const marksRef = useRef<Marks>(initialAvailability);
  const painting = useRef(false);
  const strokeChanges = useRef<Map<string, SlotUpdate>>(new Map());
  const lastPainted = useRef<CellIndex | null>(null);
  const preferSets = useRef(true);
  // A touch that has landed but not yet decided between scroll and paint.
  const hold = useRef<{ cell: CellIndex; x: number; y: number; timer: number } | null>(null);

  const paintCells = useCallback(
    (cells: CellIndex[]) => {
      let next = marksRef.current;
      for (const { dateIdx, hourIdx } of cells) {
        const date = dates[dateIdx];
        const hour = hours[hourIdx];
        if (date === undefined || hour === undefined) continue;
        const res = applyBrush(next, date, hour, brush, preferSets.current);
        if (!res.change) continue;
        next = res.marks;
        strokeChanges.current.set(slotKey(date, hour), res.change);
      }
      if (next !== marksRef.current) {
        marksRef.current = next;
        setMarks(next);
      }
    },
    [brush, dates, hours],
  );

  const extendStroke = useCallback(
    (cell: CellIndex) => {
      paintCells(cellsBetween(lastPainted.current, cell));
      lastPainted.current = cell;
    },
    [paintCells],
  );

  const beginStroke = useCallback(
    (cell: CellIndex) => {
      painting.current = true;
      lastPainted.current = null;
      if (brush === "PREFER") {
        const first = marksRef.current[slotKey(dates[cell.dateIdx], hours[cell.hourIdx])];
        preferSets.current = preferStrokeSets(first);
      }
      extendStroke(cell);
    },
    [brush, dates, hours, extendStroke],
  );

  const endStroke = useCallback(() => {
    if (!painting.current) return;
    painting.current = false;
    lastPainted.current = null;
    const changes = [...strokeChanges.current.values()];
    strokeChanges.current.clear();
    if (changes.length === 0) return;
    setSaveState("saving");
    saveAvailability(roomId, participantId, changes)
      .then((res) => {
        if (res.ok) {
          setSaveState("saved");
        } else if (res.code === "removed" || res.code === "mismatch") {
          // This browser is no longer this participant: re-render from the
          // server, which shows the join form (removed) or the right grid.
          setSaveState("removed");
          router.refresh();
        } else {
          setSaveState("error");
        }
      })
      .catch(() => setSaveState("error"));
  }, [roomId, participantId, router]);

  const cancelHold = useCallback(() => {
    if (!hold.current) return;
    window.clearTimeout(hold.current.timer);
    hold.current = null;
  }, []);

  useEffect(() => {
    if (saveState !== "saved") return;
    const t = setTimeout(() => setSaveState("idle"), 1500);
    return () => clearTimeout(t);
  }, [saveState]);

  useEffect(() => {
    function handleUp() {
      const pending = hold.current;
      if (pending) {
        // Lifted before the hold timer: a tap, paints just that cell.
        cancelHold();
        beginStroke(pending.cell);
      }
      endStroke();
    }
    function handleCancel() {
      // The browser took the touch over (it started scrolling).
      cancelHold();
      endStroke();
    }
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleCancel);
    return () => {
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleCancel);
      cancelHold();
    };
  }, [beginStroke, cancelHold, endStroke]);

  useEffect(() => {
    // Once a touch stroke is painting, keep the browser from turning the
    // finger's movement into a scroll. Must be a non-passive native
    // listener: React's onTouchMove is passive and cannot preventDefault.
    const grid = gridRef.current;
    if (!grid) return;
    function handleTouchMove(e: TouchEvent) {
      if (painting.current) e.preventDefault();
    }
    grid.addEventListener("touchmove", handleTouchMove, { passive: false });
    return () => grid.removeEventListener("touchmove", handleTouchMove);
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const cell = cellAt(e.clientX, e.clientY);
      if (!cell) return;
      if (e.pointerType === "touch") {
        cancelHold();
        const timer = window.setTimeout(() => {
          hold.current = null;
          beginStroke(cell);
          navigator.vibrate?.(10);
        }, TOUCH_HOLD_MS);
        hold.current = { cell, x: e.clientX, y: e.clientY, timer };
        return;
      }
      if (e.button !== 0) return;
      beginStroke(cell);
    },
    [beginStroke, cancelHold],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (painting.current) {
        const cell = cellAt(e.clientX, e.clientY);
        if (cell) extendStroke(cell);
        return;
      }
      const pending = hold.current;
      if (pending && Math.hypot(e.clientX - pending.x, e.clientY - pending.y) > TOUCH_SLOP_PX) {
        cancelHold(); // moved too soon: this touch is a scroll
      }
    },
    [cancelHold, extendStroke],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-wrap gap-1.5">
          {BRUSH_KEYS.map((b) => (
            <button
              key={b.value}
              type="button"
              onClick={() => setBrush(b.value)}
              aria-pressed={brush === b.value}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                brush === b.value
                  ? "border-accent bg-accent/10"
                  : "border-border"
              }`}
            >
              <span className={`size-3 rounded-sm ${b.swatchClass}`} />
              {t(`brushes.${BRUSH_LABEL_KEYS[b.value]}`)}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted">
          {saveState === "saving" && t("saving")}
          {saveState === "saved" && t("saved")}
          {saveState === "error" && t("saveError")}
          {saveState === "removed" && t("removed")}
        </span>
      </div>

      <p className="text-xs text-muted">{t("instructions")}</p>

      <div
        data-testid="grid-scroll"
        className="max-h-[70vh] overflow-auto rounded-md border border-border"
      >
        <div
          ref={gridRef}
          className="inline-grid select-none"
          style={{
            gridTemplateColumns: `72px repeat(${dates.length}, minmax(56px, 1fr))`,
            // Scrolling and pinch-zoom stay native; a stroke opts out of
            // scrolling through the touchmove listener above.
            touchAction: "manipulation",
            WebkitTouchCallout: "none",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onContextMenu={(e) => {
            // A long press must not open the context menu mid-stroke.
            if (hold.current || painting.current) e.preventDefault();
          }}
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

          {hours.map((hour, hourIdx) => (
            <Fragment key={`h-${hour}`}>
              <div className="sticky left-0 z-10 border-r border-t border-border bg-surface px-2 py-1.5 text-right text-xs text-muted">
                {formatHour(hour)}
              </div>
              {dates.map((date, dateIdx) => {
                const key = slotKey(date, hour);
                const mark = marks[key];
                return (
                  <div
                    key={key}
                    data-testid={`slot-${date}-${hour}`}
                    data-date-idx={dateIdx}
                    data-hour-idx={hourIdx}
                    className={`relative h-10 border-l border-t border-border ${cellClass(mark, isWeekend(date))}`}
                  >
                    {mark?.preferred && (
                      <span className="pointer-events-none absolute right-0.5 top-0.5 text-[10px] leading-none text-amber-900">
                        ★
                      </span>
                    )}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
