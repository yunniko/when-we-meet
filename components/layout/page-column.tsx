import type { ReactNode } from "react";

// The page's column. Route files compose this instead of drawing their own wrapper, so every width lives here and
// on the ui-kit page (ui-kit D011).
const WIDTHS = {
  /** A single form: the join view. */
  narrow: "max-w-md pt-12",
  /** Running text: the about page. */
  text: "max-w-2xl py-8",
  /** A table: the status page. */
  table: "max-w-3xl py-8",
  /** A room and its grid. */
  wide: "max-w-4xl py-8",
} as const;

export type PageWidth = keyof typeof WIDTHS;

export function PageColumn({ width, actions, children }: { width: PageWidth; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className={`mx-auto w-full px-4 ${WIDTHS[width]}`}>
      {actions && <div className="flex justify-end">{actions}</div>}
      {children}
    </div>
  );
}
