// The kit's looks: class strings and the function that builds them. No "use client" here, on purpose: a server
// component calls `buttonClass()` and reads `linkClass`, and an export of a client module is only a reference on
// the server (D012). Components that need the browser import their looks from this file.
import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "danger" | "link" | "muted-link" | "danger-link";
export type ButtonSize = "md" | "sm";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
const LINK = `underline underline-offset-2 hover:decoration-2 ${FOCUS}`;

/** The text-link looks, for a router link (`<Link className={linkClass}>`) as well as the link variants. */
export const linkClass = `font-medium text-accent ${LINK}`;
/** A secondary link that should not draw the eye ("Not you?", a footer link). */
export const mutedLinkClass = `text-text-muted hover:text-text ${LINK}`;
/** A link that starts something destructive; the action itself still asks first (ConfirmDialog). */
export const dangerLinkClass = `text-danger ${LINK}`;

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent/90",
  secondary: "border border-border bg-surface-raised text-text hover:bg-surface aria-pressed:border-accent aria-pressed:bg-accent/10",
  danger: "border border-danger bg-surface text-danger hover:bg-surface-raised",
  // An action that reads as a link ("Change", "Not you?"): a button to assistive tech, a link to the eye.
  link: `px-1 ${linkClass}`,
  "muted-link": `px-1 ${mutedLinkClass}`,
  "danger-link": `px-1 ${dangerLinkClass}`,
};
const SIZES: Record<ButtonSize, string> = { md: "px-4 text-base", sm: "gap-1.5 px-3 text-sm" };
const isLink = (variant: ButtonVariant) => variant.endsWith("link");

/**
 * The look of a button, for a router link that must look like one (`<Link className={buttonClass("secondary", "sm")}>`).
 * Every size keeps the 44px target (min-h-11, §4); `sm` only tightens the type and padding.
 */
export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md") {
  return cx(
    "inline-grid min-h-11 place-items-center rounded-md font-body",
    FOCUS,
    "disabled:opacity-60 aria-disabled:cursor-not-allowed",
    VARIANTS[variant],
    !isLink(variant) && SIZES[size]
  );
}

/** The classes every text control shares, so inputs look alike across the project. */
export const controlClass =
  "min-h-11 rounded-md border border-border bg-surface-raised px-2 text-base text-text aria-invalid:border-danger disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus";
