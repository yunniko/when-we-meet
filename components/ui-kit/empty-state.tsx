// What a list or view shows when it has nothing yet (COMPANY/UI_STANDARDS.md §3: empty): what is missing, and the
// one action that fills it.
import type { ReactNode } from "react";
import { cx } from "./cx";

export type EmptyStateProps = { title: string; body?: string; action?: ReactNode; className?: string };

export function EmptyState({ title, body, action, className }: EmptyStateProps) {
  return (
    <div className={cx("flex flex-col items-center gap-2 p-4 text-center", className)}>
      <p className="m-0 text-base text-text">{title}</p>
      {body && <p className="m-0 text-sm text-text-muted">{body}</p>}
      {action}
    </div>
  );
}
