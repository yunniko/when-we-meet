import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isRoomExpired } from "@/lib/expiry";
import { PageColumn } from "@/components/layout/page-column";
import { StatusView } from "./status-view";

// Internal ops tool, not a user-facing page — deliberately not wired into
// next-intl (see HANDOVER "Status page"). Gated by a shared-secret query
// token rather than accounts, consistent with the rest of the app's
// no-login trust model; unset/mismatched token always 404s rather than
// revealing the page exists.
const PAGE_SIZE = 25;

function formatTimestamp(d: Date): string {
  return d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

export default async function StatusPage({ searchParams }: { searchParams: Promise<{ key?: string; page?: string }> }) {
  const { key, page: pageParam } = await searchParams;
  const token = process.env.STATUS_PAGE_TOKEN;
  if (!token || key !== token) notFound();

  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);

  // Joined and invited-but-unclaimed participants are counted apart
  // (G-004, D011), so invites don't inflate apparent participation.
  const [totalRooms, joinedParticipants, invitedParticipants, rooms] = await Promise.all([
    prisma.room.count(),
    prisma.participant.count({ where: { joinedAt: { not: null } } }),
    prisma.participant.count({ where: { joinedAt: null } }),
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
        participants: { select: { joinedAt: true } },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalRooms / PAGE_SIZE));
  const pageLink = (p: number) => `/status?key=${encodeURIComponent(token)}&page=${p}`;

  return (
    <PageColumn width="table">
      <StatusView
        totals={{ rooms: totalRooms, joined: joinedParticipants, invited: invitedParticipants }}
        rooms={rooms.map((room) => {
          const joined = room.participants.filter((p) => p.joinedAt !== null).length;
          return {
            id: room.id,
            title: room.title,
            created: formatTimestamp(room.createdAt),
            expired: isRoomExpired(room),
            joined,
            invited: room.participants.length - joined,
          };
        })}
        page={page}
        totalPages={totalPages}
        prevHref={page > 1 ? pageLink(page - 1) : null}
        nextHref={page < totalPages ? pageLink(page + 1) : null}
      />
    </PageColumn>
  );
}
