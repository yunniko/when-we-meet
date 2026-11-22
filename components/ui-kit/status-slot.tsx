"use client";
// The result of an action, shown where the action happened (COMPANY/UI_STANDARDS.md §3: result, status). The live
// region is always in the page, so a change is announced, and its line is always reserved, so nothing moves.
// Place it last in its row, or give it a width, so its text cannot push siblings sideways.
import { cx } from "./cx";

export type StatusTone = "neutral" | "success" | "danger";

const TONES: Record<StatusTone, string> = { neutral: "text-text-muted", success: "text-success", danger: "text-danger" };

export function StatusSlot({ message, tone = "neutral", className }: { message?: string | null; tone?: StatusTone; className?: string }) {
  return (
    <p role="status" className={cx("m-0 min-h-lh text-sm", TONES[tone], className)}>
      {message}
    </p>
  );
}
