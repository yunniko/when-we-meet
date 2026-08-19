import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isRoomExpired } from "@/lib/expiry";

// Internal ops tool, not a user-facing page — deliberately not wired into
// next-intl (see HANDOVER "Status page"). Gated by a shared-secret query
// token rather than accounts, consistent with the rest of the app's
// no-login trust model; unset/mismatched token always 404s rather than
// revealing the page exists.
const PAGE_SIZE = 25;

function formatTimestamp(d: Date): string {
  return d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

export default async function StatusPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; page?: string }>;
}) {
  const { key, page: pageParam } = await searchParams;
  const token = process.env.STATUS_PAGE_TOKEN;
  if (!token || key !== token) notFound();

  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);

  const [totalRooms, totalParticipants, rooms] = await Promise.all([
    prisma.room.count(),
    prisma.participant.count(),
    prisma.room.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        title: true,
        createdAt: true,
        endDate: true,
        selectedDate: true,
        _count: { select: { participants: true } },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalRooms / PAGE_SIZE));
  const pageLink = (p: number) => `/status?key=${encodeURIComponent(token)}&page=${p}`;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Status</h1>
      <p className="mt-1 text-sm text-muted">
        {totalRooms} {totalRooms === 1 ? "room" : "rooms"} ·{" "}
        {totalParticipants} {totalParticipants === 1 ? "participant" : "participants"}
      </p>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted">
              <th className="px-4 py-2 font-medium">Room</th>
              <th className="px-4 py-2 font-medium">Created</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Participants</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => {
              const expired = isRoomExpired(room);
              return (
                <tr key={room.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2">{room.title || "Untitled room"}</td>
                  <td className="px-4 py-2 text-muted">{formatTimestamp(room.createdAt)}</td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        expired
                          ? "rounded-full bg-muted/20 px-2 py-0.5 text-xs font-medium text-muted"
                          : "rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700"
                      }
                    >
                      {expired ? "expired" : "active"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted">{room._count.participants}</td>
                </tr>
              );
            })}
            {rooms.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-muted" colSpan={4}>
                  No rooms.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        {page > 1 ? (
          <Link href={pageLink(page - 1)} className="font-medium text-accent underline hover:text-accent-hover">
            ← Previous
          </Link>
        ) : (
          <span />
        )}
        <span className="text-muted">
          Page {page} of {totalPages}
        </span>
        {page < totalPages ? (
          <Link href={pageLink(page + 1)} className="font-medium text-accent underline hover:text-accent-hover">
            Next →
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
