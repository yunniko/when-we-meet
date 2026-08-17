import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { findActiveRoom } from "@/lib/room-access";
import { getCurrentParticipant } from "@/lib/participant";
import { isRoomOwner } from "@/lib/owner";
import { dateOnly, enumerateDates, enumerateHours, formatDateRange, formatHoursWindow } from "@/lib/slots";
import type { CellMark } from "@/lib/slots";
import { JoinForm } from "@/app/r/[slug]/join-form";
import { AvailabilityGrid } from "@/app/r/[slug]/availability-grid";
import { FinalizedBanner } from "@/app/r/[slug]/finalized-banner";
import { LeaveRoomButton } from "@/app/r/[slug]/leave-room-button";
import { leaveIdentity } from "@/app/r/[slug]/actions";
import { NewEventButton } from "@/app/new-event-button";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const room = await findActiveRoom(slug);
  if (!room) notFound();

  const isFinalized = room.selectedDate !== null && room.selectedHour !== null;
  const isOwner = await isRoomOwner(room);
  const banner = isFinalized && (
    <FinalizedBanner
      roomId={room.id}
      slug={room.slug}
      date={dateOnly(room.selectedDate!)}
      hour={room.selectedHour!}
      isOwner={isOwner}
    />
  );

  const participant = await getCurrentParticipant(room.id);
  const otherParticipants = await prisma.participant.findMany({
    where: { roomId: room.id, ...(participant ? { NOT: { id: participant.id } } : {}) },
    select: { name: true },
    orderBy: { createdAt: "asc" },
  });

  if (!participant) {
    return (
      <div className="mx-auto w-full max-w-md px-4 pt-12">
        <div className="flex justify-end">
          <NewEventButton />
        </div>
        {banner}
        <JoinForm
          roomId={room.id}
          slug={room.slug}
          roomTitle={room.title}
          dateRangeLabel={formatDateRange(room.startDate, room.endDate)}
          hoursLabel={formatHoursWindow(room.dayStartHour, room.dayEndHour)}
          timezone={room.timezone}
          participantNames={otherParticipants.map((p) => p.name)}
        />
      </div>
    );
  }

  const dates = enumerateDates(room.startDate, room.endDate);
  const hours = enumerateHours(room.dayStartHour, room.dayEndHour);

  const availability = await prisma.availability.findMany({
    where: { participantId: participant.id },
  });
  const initialAvailability: Record<string, CellMark> = {};
  for (const a of availability) {
    initialAvailability[`${dateOnly(a.slotDate)}T${a.slotHour}`] = {
      status: a.status,
      preferred: a.preferred,
    };
  }

  const hoursLabel = formatHoursWindow(room.dayStartHour, room.dayEndHour);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {room.title || "Untitled room"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {formatDateRange(room.startDate, room.endDate)} ·{" "}
            {hoursLabel} · {room.timezone}
          </p>
        </div>
        <div className="text-right text-sm">
          <div className="mb-2">
            <NewEventButton />
          </div>
          <p>
            Marking as <span className="font-medium">{participant.name}</span>
          </p>
          <form action={leaveIdentity.bind(null, { roomId: room.id, slug: room.slug })}>
            <button
              type="submit"
              className="text-xs text-muted underline hover:text-foreground"
            >
              Not you? Use a different name
            </button>
          </form>
          <div className="mt-1">
            <LeaveRoomButton roomId={room.id} slug={room.slug} />
          </div>
        </div>
      </div>

      {banner}

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {otherParticipants.length > 0 ? (
            <p className="text-sm text-muted">
              Also in this room: {otherParticipants.map((p) => p.name).join(", ")}
            </p>
          ) : (
            <span />
          )}
          <Link
            href={`/r/${room.slug}/results`}
            className="text-sm font-medium text-accent underline hover:text-accent-hover"
          >
            See results →
          </Link>
        </div>

        {isFinalized ? (
          <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
            The meeting time has been set — availability marking is closed.
          </p>
        ) : (
          <AvailabilityGrid
            roomId={room.id}
            dates={dates}
            hours={hours}
            initialAvailability={initialAvailability}
          />
        )}
      </div>
    </div>
  );
}
