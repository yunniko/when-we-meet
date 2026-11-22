"use client";
// A group of controls that share one question: radios, checkboxes, or a pair such as a date range. One legend,
// one reserved message slot (Field's twin for a fieldset; COMPANY/UI_STANDARDS.md §3, §4). The group is described by it.
import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cx } from "./cx";

export type FieldGroupProps = {
  legend: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** The group can show an error: reserve its line even with no hint. */
  validates?: boolean;
  className?: string;
  children: ReactNode;
};

export function FieldGroup({ legend, hint, error, validates = false, className, children }: FieldGroupProps) {
  const slotId = `${useId()}-message`;
  const hasSlot = validates || hint != null || error != null;
  const message = error ?? hint;
  return (
    <fieldset
      aria-describedby={message != null ? slotId : undefined}
      className={cx("m-0 flex min-w-0 flex-col gap-2 border-0 p-0", className)}
    >
      <legend className="mb-1 p-0 text-sm text-text">{legend}</legend>
      {children}
      {hasSlot && (
        <p id={slotId} className={cx("m-0 min-h-lh text-sm", error != null ? "text-danger" : "text-text-muted")}>
          {error != null && <span aria-hidden className="mr-1 inline-block size-2 rounded-full bg-danger align-middle" />}
          {message}
        </p>
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
