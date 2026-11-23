"use client";
// A form field with one message slot under the control (COMPANY/UI_STANDARDS.md §3, §4). The slot holds the hint
// or, when there is one, the error in its place, so the two never stack. When the field can show an error
// (`validates`) or has a hint, the slot is reserved before anything appears in it; pass the field's possible errors
// as `reserve` and it is as tall as the longest of them, so nothing below moves (see message-slot.tsx).
import { useId, type ReactNode } from "react";
import { cx } from "./cx";
import { MessageSlot } from "./message-slot";

export type FieldControlProps = { id: string; "aria-describedby"?: string; "aria-invalid"?: true };

export type FieldProps = {
  label: ReactNode;
  /** One line at most (hint cap); a longer explanation belongs in InlineHelp. */
  hint?: ReactNode;
  error?: ReactNode;
  /** The field can show an error: reserve its line even with no hint. */
  validates?: boolean;
  /** Every error this field can show, so the slot is sized for the longest (a string hint is included already). */
  reserve?: string[];
  /** Placed after the label, e.g. an InlineHelp. */
  labelExtra?: ReactNode;
  className?: string;
  /** Render the control, spreading the props onto it: `{(p) => <input {...p} />}`. */
  children: (control: FieldControlProps) => ReactNode;
};

export function Field({ label, hint, error, validates = false, reserve, labelExtra, className, children }: FieldProps) {
  const id = useId();
  const slotId = `${id}-message`;
  const hasSlot = validates || hint != null || error != null || (reserve?.length ?? 0) > 0;
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
        <MessageSlot
          id={slotId}
          message={message}
          error={error != null}
          reserve={typeof hint === "string" ? [hint, ...(reserve ?? [])] : reserve}
          toneClass={error != null ? "text-danger" : "text-text-muted"}
        />
      )}
    </div>
  );
}
