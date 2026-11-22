"use client";
// A form field with one message slot under the control (COMPANY/UI_STANDARDS.md §3, §4). The slot holds the hint
// or, when there is one, the error in its place, so the two never stack. When the field can show an error
// (`validates`) or has a hint, the slot's line is reserved before anything appears in it: no layout shift.
import { useId, type ReactNode } from "react";
import { cx } from "./cx";

export type FieldControlProps = { id: string; "aria-describedby"?: string; "aria-invalid"?: true };

export type FieldProps = {
  label: ReactNode;
  /** One line at most (hint cap); a longer explanation belongs in InlineHelp. */
  hint?: ReactNode;
  error?: ReactNode;
  /** The field can show an error: reserve its line even with no hint. */
  validates?: boolean;
  /** Placed after the label, e.g. an InlineHelp. */
  labelExtra?: ReactNode;
  className?: string;
  /** Render the control, spreading the props onto it: `{(p) => <input {...p} />}`. */
  children: (control: FieldControlProps) => ReactNode;
};

export function Field({ label, hint, error, validates = false, labelExtra, className, children }: FieldProps) {
  const id = useId();
  const slotId = `${id}-message`;
  const hasSlot = validates || hint != null || error != null;
  const message = error ?? hint;
  return (
    <div className={cx("flex flex-col gap-1", className)}>
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="text-sm text-text">
          {label}
        </label>
        {labelExtra}
      </div>
      {children({ id, "aria-describedby": message != null ? slotId : undefined, "aria-invalid": error != null ? true : undefined })}
      {hasSlot && (
        <p id={slotId} className={cx("m-0 min-h-lh text-sm", error != null ? "text-danger" : "text-text-muted")}>
          {error != null && <span aria-hidden className="mr-1 inline-block size-2 rounded-full bg-danger align-middle" />}
          {message}
        </p>
      )}
    </div>
  );
}

/** The classes every text control shares, so inputs look alike across the project. */
export const controlClass =
  "min-h-11 rounded-md border border-border bg-surface-raised px-2 text-base text-text aria-invalid:border-danger focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus";
