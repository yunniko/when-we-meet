import type { HTMLAttributes, ReactNode } from "react";

// The raised card every main block sits in (the create form, the grid, the results, the participants, the status
// table). One look, here, so it changes in one place (ui-kit D011).
const PADDING = {
  default: "p-6",
  /** The landing form: more air on wider screens. */
  roomy: "p-6 sm:p-8",
  /** Content that runs to the edge, such as a table. */
  flush: "overflow-hidden",
} as const;

export function Panel({
  as: Tag = "div",
  padding = "default",
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLElement> & { as?: "div" | "section"; padding?: keyof typeof PADDING; children: ReactNode }) {
  return (
    <Tag {...rest} className={`rounded-2xl border border-border bg-surface shadow-sm ${PADDING[padding]} ${className}`}>
      {children}
    </Tag>
  );
}
