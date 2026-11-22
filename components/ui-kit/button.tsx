"use client";
// One button for the whole project (COMPANY/UI_STANDARDS.md §2). While `busy`, it keeps its width (the label
// stays in the layout, invisible, with the spinner over it), ignores presses and is named by `busyLabel`.
import type { ButtonHTMLAttributes, MouseEvent } from "react";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "danger";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent/90",
  secondary: "border border-border bg-surface-raised text-text hover:bg-surface",
  danger: "border border-danger bg-surface text-danger hover:bg-surface-raised",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  busy?: boolean;
  /** What a screen reader hears while busy, e.g. "Saving". Give it whenever `busy` can be true. */
  busyLabel?: string;
};

export function Button({
  variant = "primary",
  busy = false,
  busyLabel,
  className,
  children,
  onClick,
  type = "button",
  ...rest
}: ButtonProps) {
  const inert = busy || rest["aria-disabled"] === true || rest["aria-disabled"] === "true";
  const press = (e: MouseEvent<HTMLButtonElement>) => {
    if (inert) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  };
  return (
    <button
      {...rest}
      type={type}
      onClick={press}
      aria-disabled={inert || undefined}
      className={cx(
        // min-h-11 is the standard's 44px target (§4), not a spacing step.
        "inline-grid min-h-11 place-items-center rounded-md px-4 font-body text-base",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        "disabled:opacity-60 aria-disabled:cursor-not-allowed",
        VARIANTS[variant],
        className
      )}
    >
      <span className={cx("col-start-1 row-start-1", busy && "invisible")}>{children}</span>
      {busy && (
        <span className="col-start-1 row-start-1 inline-flex items-center" data-ui-kit-busy="">
          <span aria-hidden className="size-4 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin" />
          <span className="sr-only">{busyLabel}</span>
        </span>
      )}
    </button>
  );
}
