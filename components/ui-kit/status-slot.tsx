"use client";
// The result of an action, shown where the action happened (COMPANY/UI_STANDARDS.md §3: result, status). The live
// region is always in the page, so a change is announced, and its line is always reserved, so nothing moves.
// Place it last in its row, or give it a width, so its text cannot push siblings sideways. Pass every message it
// can show as `reserve`, so a longer one that wraps cannot push what follows down (see message-slot.tsx).
import { MessageSlot } from "./message-slot";

export type StatusTone = "neutral" | "success" | "danger";

const TONES: Record<StatusTone, string> = { neutral: "text-text-muted", success: "text-success", danger: "text-danger" };

export type StatusSlotProps = { message?: string | null; tone?: StatusTone; reserve?: string[]; className?: string };

export function StatusSlot({ message, tone = "neutral", reserve, className }: StatusSlotProps) {
  return (
    <MessageSlot
      role="status"
      message={message}
      error={tone === "danger"}
      reserve={reserve}
      toneClass={TONES[tone]}
      className={className}
    />
  );
}
