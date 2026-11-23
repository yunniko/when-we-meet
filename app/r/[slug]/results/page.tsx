import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { findActiveRoom } from "@/lib/room-access";
import { getCurrentParticipant } from "@/lib/participant";
import { isRoomOwner } from "@/lib/owner";
import { dateOnly, enumerateDates, enumerateHours, formatDateRange, formatHoursWindow } from "@/lib/slots";
import { computeResults } from "@/lib/results";
import { splitRoster } from "@/lib/roster";
import { FinalizedBanner } from "@/app/r/[slug]/finalized-banner";
import { ResultsBoard } from "@/app/r/[slug]/results-board";
import { NewEventButton } from "@/app/new-event-button";
import { RoomHeader } from "@/app/r/[slug]/room-header";
import { PageColumn } from "@/components/layout/page-column";
import { Panel } from "@/components/layout/panel";
import { TextLink } from "@/components/layout/text-link";

export default async function ResultsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const room = await findActiveRoom(slug);
  if (!room) notFound();

  const participant = await getCurrentParticipant(room.id);
  if (!participant) redirect(`/r/${slug}`);

  const t = await getTranslations("ResultsPage");
  const tCommon = await getTranslations("Common");

  const isFinalized = room.selectedDate !== null && room.selectedHour !== null;
  const isOwner = await isRoomOwner(room);

  const dates = enumerateDates(room.startDate, room.endDate);
  const hours = enumerateHours(room.dayStartHour, room.dayEndHour);
  // Only people who have joined count towards the results; invited names
  // nobody has claimed yet (G-004) are pending, which keeps "everyone" honest.
  const roster = splitRoster(
    await prisma.participant.findMany({
      where: { roomId: room.id },
      select: { id: true, name: true, joinedAt: true, createdAt: true },
    })
  );
  const participants = roster.joined;
  const totalParticipants = participants.length;
  const rows = await prisma.availability.findMany({
    where: { participant: { roomId: room.id, joinedAt: { not: null } } },
    select: {
      slotDate: true,
      slotHour: true,
      status: true,
      preferred: true,
      participant: { select: { name: true } },
    },
  });
  const namedRows = rows.map((r) => ({ ...r, participantName: r.participant.name }));

  const results = computeResults(
    dates,
    hours,
    participants.map((p) => p.name),
    namedRows,
    { pendingInvites: roster.invited.length }
  );
  const topResults = results.filter((r) => r.canCount > 0).slice(0, 10);

  const details = [
    `${formatDateRange(room.startDate, room.endDate)} · ${formatHoursWindow(room.dayStartHour, room.dayEndHour)} · ${room.timezone} · ${t("peopleCount", { count: totalParticipants })}`,
    t("participantsLabel", { names: participants.map((p) => p.name).join(", ") }),
  ];
  if (roster.invited.length > 0) {
    const joinedOfExpected = t("joinedOfExpected", { joined: participants.length, expected: participants.length + roster.invited.length });
    details.push(`${joinedOfExpected} · ${t("notJoinedYet", { names: roster.invited.map((p) => p.name).join(", ") })}`);
  }

  return (
    <PageColumn width="wide">
      <RoomHeader
        title={t("pageTitle", { title: room.title || tCommon("untitledRoom") })}
        details={details}
        description={room.description}
        actions={
          <>
            <NewEventButton />
            <TextLink href={`/r/${room.slug}`} size="sm">
              {t("editLink")}
            </TextLink>
          </>
        }
      />

      {isFinalized && (
        <FinalizedBanner
          roomId={room.id}
          slug={room.slug}
          date={dateOnly(room.selectedDate!)}
          hour={room.selectedHour!}
          isOwner={isOwner}
        />
      )}

      <Panel>
        <ResultsBoard
          roomId={room.id}
          slug={room.slug}
          dates={dates}
          hours={hours}
          results={results}
          topResults={topResults}
          canPick={isOwner && !isFinalized}
        />
      </Panel>
    </PageColumn>
  );
}
