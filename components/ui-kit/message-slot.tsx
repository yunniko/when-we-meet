// The one place a message slot is drawn (COMPANY/UI_STANDARDS.md §4). Field, FieldGroup and StatusSlot use it.
// The slot is as tall as the tallest of its shown message and every message in `reserve`, measured by the
// browser at the current width and in the current language: each candidate sits invisibly in the same grid
// cell, drawn as generated content (`::after`), so it takes space but is not text: no locator, find-in-page,
// copy or screen reader meets it twice. That is why candidates are strings. A one-line reservation was not enough; in the when-we-meet pilot a quarter of all hints and errors
// wrapped at 390px, and each one moved everything below it (ui-kit docs/reviews/2026-11-22-pilot-calibration.md).
import type { ReactNode } from "react";
import { cx } from "./cx";

/** The error marker: colour is never the only sign (§5). Also drawn in every reserved candidate, so an error
 * that adds it cannot outgrow the reservation. */
const Dot = ({ hidden }: { hidden?: boolean }) => (
  <span aria-hidden className={cx("mr-1 inline-block size-2 rounded-full align-middle", !hidden && "bg-danger")} />
);

export type MessageSlotProps = {
  id?: string;
  role?: "status";
  message?: ReactNode;
  /** Draw the error marker before `message`. */
  error?: boolean;
  /** Every other message this slot can show. Takes space only: not text in the page, never announced. */
  reserve?: string[];
  /** Colour classes for the shown message. */
  toneClass: string;
  className?: string;
};

export function MessageSlot({ id, role, message, error = false, reserve = [], toneClass, className }: MessageSlotProps) {
  return (
    <div id={id} role={role} className={cx("m-0 grid min-h-lh text-sm", className)}>
      {reserve.map((candidate, i) => (
        <span key={i} aria-hidden data-reserve={candidate} className="invisible col-start-1 row-start-1 after:content-[attr(data-reserve)]">
          <Dot hidden />
        </span>
      ))}
      <span className={cx("col-start-1 row-start-1", toneClass)}>
        {error && message != null && <Dot />}
        {message}
      </span>
    </div>
  );
}
