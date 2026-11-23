"use client";
// One button for the whole project (COMPANY/UI_STANDARDS.md §2). While `busy`, it keeps its width (the label
// stays in the layout, invisible, with the spinner over it), ignores presses and is named by `busyLabel`.
import type { ButtonHTMLAttributes, MouseEvent } from "react";
import { cx } from "./cx";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./looks";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  busy?: boolean;
  /** What a screen reader hears while busy, e.g. "Saving". Give it whenever `busy` can be true. */
  busyLabel?: string;
};

export function Button({
  variant = "primary",
  size = "md",
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
    <button {...rest} type={type} onClick={press} aria-disabled={inert || undefined} className={cx(buttonClass(variant, size), className)}>
      <span className={cx("col-start-1 row-start-1 inline-flex items-center gap-[inherit]", busy && "invisible")}>{children}</span>
      {busy && (
        <span className="col-start-1 row-start-1 inline-flex items-center" data-ui-kit-busy="">
          <span aria-hidden className="size-4 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin" />
          <span className="sr-only">{busyLabel}</span>
        </span>
      )}
    </button>
  );
}
