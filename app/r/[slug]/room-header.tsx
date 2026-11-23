import type { ReactNode } from "react";

// The top of a room and of its results: what the room is on the left, the person's own actions on the right.
export function RoomHeader({
  title,
  details,
  description,
  actions,
}: {
  title: string;
  /** Muted lines under the title: dates, hours, who is in. */
  details: string[];
  description?: string | null;
  actions: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {details.map((line) => (
          <p key={line} className="mt-1 text-sm wrap-anywhere text-text-muted">
            {line}
          </p>
        ))}
        {description && <p className="mt-2 text-sm whitespace-pre-wrap">{description}</p>}
      </div>
      <div className="flex min-w-0 flex-col gap-2 text-sm wrap-anywhere sm:items-end sm:text-right">{actions}</div>
    </div>
  );
}
