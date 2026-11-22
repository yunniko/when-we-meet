"use client";
// A group of controls that share one question: radios, checkboxes, or a pair such as a date range. One legend,
// one reserved message slot (Field's twin for a fieldset; COMPANY/UI_STANDARDS.md §3, §4). The group is described by it.
import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cx } from "./cx";
import { MessageSlot } from "./message-slot";

export type FieldGroupProps = {
  legend: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** The group can show an error: reserve its line even with no hint. */
  validates?: boolean;
  /** Every error this group can show, so the slot is sized for the longest (a string hint is included already). */
  reserve?: string[];
  className?: string;
  children: ReactNode;
};

export function FieldGroup({ legend, hint, error, validates = false, reserve, className, children }: FieldGroupProps) {
  const slotId = `${useId()}-message`;
  const hasSlot = validates || hint != null || error != null || (reserve?.length ?? 0) > 0;
  const message = error ?? hint;
  return (
    <fieldset
      aria-describedby={message != null ? slotId : undefined}
      className={cx("m-0 flex min-w-0 flex-col gap-2 border-0 p-0", className)}
    >
      <legend className="mb-1 p-0 text-sm text-text">{legend}</legend>
      {children}
      {hasSlot && (
        <MessageSlot
          id={slotId}
          message={message}
          error={error != null}
          reserve={typeof hint === "string" ? [hint, ...(reserve ?? [])] : reserve}
          toneClass={error != null ? "text-danger" : "text-text-muted"}
        />
      )}
    </fieldset>
  );
}

/** A radio or checkbox with its label, at least 44px tall to hit (§4). */
export function Choice({ children, ...input }: InputHTMLAttributes<HTMLInputElement> & { children: ReactNode }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-base text-text">
      <input {...input} className="size-4 shrink-0 accent-accent" />
      <span>{children}</span>
    </label>
  );
}
