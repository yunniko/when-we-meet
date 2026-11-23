import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { findActiveRoom } from "@/lib/room-access";
import { getCurrentParticipant } from "@/lib/participant";
import { getOwnerToken } from "@/lib/cookies";
import { isRoomOwner } from "@/lib/owner";
import { splitRoster } from "@/lib/roster";
import { dateOnly, enumerateDates, enumerateHours, formatDateRange, formatHoursWindow } from "@/lib/slots";
import type { CellMark } from "@/lib/slots";
import { JoinForm } from "@/app/r/[slug]/join-form";
import { AvailabilityGrid } from "@/app/r/[slug]/availability-grid";
import { FinalizedBanner } from "@/app/r/[slug]/finalized-banner";
import { ParticipantsPanel } from "@/app/r/[slug]/participants-panel";
import { NewEventButton } from "@/app/new-event-button";
import { IdentityPanel } from "@/app/r/[slug]/identity-panel";
import { PlanningClosed } from "@/app/r/[slug]/planning-closed";
import { RoomHeader } from "@/app/r/[slug]/room-header";
import { RoomRoster } from "@/app/r/[slug]/room-roster";
import { PageColumn } from "@/components/layout/page-column";
import { Panel } from "@/components/layout/panel";

export default async function RoomPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const room = await findActiveRoom(slug);
  if (!room) notFound();

  const tCommon = await getTranslations("Common");

  const isFinalized = room.selectedDate !== null && room.selectedHour !== null;
  const isOwner = await isRoomOwner(room);
  const banner = isFinalized && (
    <FinalizedBanner roomId={room.id} slug={room.slug} date={dateOnly(room.selectedDate!)} hour={room.selectedHour!} isOwner={isOwner} />
  );

  const participant = await getCurrentParticipant(room.id);
  // Everyone else in the room, split into people who have joined and
  // invited names nobody has claimed yet (G-004, D011).
  const others = splitRoster(
    await prisma.participant.findMany({
      where: { roomId: room.id, ...(participant ? { NOT: { id: participant.id } } : {}) },
      select: { id: true, name: true, joinedAt: true, createdAt: true, leftAt: true },
    })
  );

  if (!participant) {
    const canUseAnyName = (await getOwnerToken(room.id)) === room.ownerToken;
    return (
      <PageColumn width="narrow" actions={<NewEventButton />}>
        {banner}
        <JoinForm
          roomId={room.id}
          slug={room.slug}
          roomTitle={room.title}
          roomDescription={room.description}
          dateRangeLabel={formatDateRange(room.startDate, room.endDate)}
          hoursLabel={formatHoursWindow(room.dayStartHour, room.dayEndHour)}
          timezone={room.timezone}
          joinedNames={others.joined.map((p) => p.name)}
          invitedNames={others.invited.map((p) => p.name)}
          listedOnly={room.joinRule === "LISTED_ONLY"}
          canUseAnyName={canUseAnyName}
        />
      </PageColumn>
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
    <PageColumn width="wide">
      <RoomHeader
        title={room.title || tCommon("untitledRoom")}
        details={[`${formatDateRange(room.startDate, room.endDate)} · ${hoursLabel} · ${room.timezone}`]}
        description={room.description}
        actions={<IdentityPanel roomId={room.id} slug={room.slug} name={participant.name} joinRule={room.joinRule} />}
      />

      {banner}

      <Panel>
        <RoomRoster
          joined={others.joined.map((p) => p.name)}
          invited={others.invited.map((p) => p.name)}
          resultsHref={`/r/${room.slug}/results`}
        />

        {isFinalized ? (
          <PlanningClosed />
        ) : (
          <AvailabilityGrid
            // Keyed by identity so a server re-render for a different
            // participant (see G-003) remounts the grid instead of keeping
            // the previous person's client-side marks.
            key={participant.id}
            roomId={room.id}
            participantId={participant.id}
            dates={dates}
            hours={hours}
            initialAvailability={initialAvailability}
          />
        )}
      </Panel>

      {isOwner && (
        <ParticipantsPanel
          roomId={room.id}
          slug={room.slug}
          ownerName={participant.name}
          joinRule={room.joinRule}
          others={[
            ...others.joined.map((p) => ({ id: p.id, name: p.name, invited: false, left: false })),
            ...others.invited.map((p) => ({
              id: p.id,
              name: p.name,
              invited: true,
              left: p.leftAt !== null,
            })),
          ]}
        />
      )}
    </PageColumn>
  );
}
