import { Panel } from "@/components/layout/panel";
import { TextLink } from "@/components/layout/text-link";

// The internal status page (not translated; see HANDOVER "Status page").
export type StatusRoom = { id: string; title: string | null; created: string; expired: boolean; joined: number; invited: number };

export function StatusView({
  totals,
  rooms,
  page,
  totalPages,
  prevHref,
  nextHref,
}: {
  totals: { rooms: number; joined: number; invited: number };
  rooms: StatusRoom[];
  page: number;
  totalPages: number;
  prevHref: string | null;
  nextHref: string | null;
}) {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Status</h1>
      <p className="mt-1 text-sm text-text-muted">
        {totals.rooms} {totals.rooms === 1 ? "room" : "rooms"} · {totals.joined} joined · {totals.invited} invited, not yet joined
      </p>

      <Panel padding="flush" className="mt-6">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-text-muted">
              <th className="px-4 py-2 font-medium">Room</th>
              <th className="px-4 py-2 font-medium">Created</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Participants</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <tr key={room.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2">{room.title || "Untitled room"}</td>
                <td className="px-4 py-2 text-text-muted">{room.created}</td>
                <td className="px-4 py-2">
                  <span
                    className={
                      room.expired
                        ? "rounded-full bg-text-muted/20 px-2 py-0.5 text-xs font-medium text-text-muted"
                        : "rounded-full bg-can/15 px-2 py-0.5 text-xs font-medium text-success"
                    }
                  >
                    {room.expired ? "expired" : "active"}
                  </span>
                </td>
                <td className="px-4 py-2 text-text-muted">
                  {room.joined}
                  {room.invited > 0 && <> (+{room.invited} invited)</>}
                </td>
              </tr>
            ))}
            {rooms.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-text-muted" colSpan={4}>
                  No rooms.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>

      <div className="mt-4 flex items-center justify-between text-sm">
        {prevHref ? <TextLink href={prevHref}>← Previous</TextLink> : <span />}
        <span className="text-text-muted">
          Page {page} of {totalPages}
        </span>
        {nextHref ? <TextLink href={nextHref}>Next →</TextLink> : <span />}
      </div>
    </>
  );
}
