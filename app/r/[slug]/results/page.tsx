import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { findActiveRoom } from "@/lib/room-access";
import { getCurrentParticipant } from "@/lib/participant";
import { isRoomOwner } from "@/lib/owner";
import { dateOnly, enumerateDates, enumerateHours, formatDateRange, formatHoursWindow } from "@/lib/slots";
import { computeResults } from "@/lib/results";
import { FinalizedBanner } from "@/app/r/[slug]/finalized-banner";
import { ResultsBoard } from "@/app/r/[slug]/results-board";

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const room = await findActiveRoom(slug);
  if (!room) notFound();

  const participant = await getCurrentParticipant(room.id);
  if (!participant) redirect(`/r/${slug}`);

  const isFinalized = room.selectedDate !== null && room.selectedHour !== null;
  const isOwner = await isRoomOwner(room);

  const dates = enumerateDates(room.startDate, room.endDate);
  const hours = enumerateHours(room.dayStartHour, room.dayEndHour);
  const participants = await prisma.participant.findMany({
    where: { roomId: room.id },
    select: { name: true },
    orderBy: { createdAt: "asc" },
  });
  const totalParticipants = participants.length;
  const rows = await prisma.availability.findMany({
    where: { participant: { roomId: room.id } },
    select: { slotDate: true, slotHour: true, status: true, preferred: true },
  });

  const results = computeResults(dates, hours, totalParticipants, rows);
  const topResults = results.filter((r) => r.canCount > 0).slice(0, 10);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {room.title || "Untitled room"} — results
          </h1>
          <p className="mt-1 text-sm text-muted">
            {formatDateRange(room.startDate, room.endDate)} ·{" "}
            {formatHoursWindow(room.dayStartHour, room.dayEndHour)} · {room.timezone} ·{" "}
            {totalParticipants} {totalParticipants === 1 ? "person" : "people"}
          </p>
          <p className="mt-1 text-sm text-muted">
            Participants: {participants.map((p) => p.name).join(", ")}
          </p>
        </div>
        <Link href={`/r/${room.slug}`} className="text-sm font-medium text-accent underline hover:text-accent-hover">
          ← Edit my availability
        </Link>
      </div>

      {isFinalized && (
        <FinalizedBanner
          roomId={room.id}
          slug={room.slug}
          date={dateOnly(room.selectedDate!)}
          hour={room.selectedHour!}
          isOwner={isOwner}
        />
      )}

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <ResultsBoard
          roomId={room.id}
          slug={room.slug}
          dates={dates}
          hours={hours}
          results={results}
          topResults={topResults}
          canPick={isOwner && !isFinalized}
        />
      </div>
    </div>
  );
}
