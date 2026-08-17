import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function RoomPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const room = await prisma.room.findUnique({ where: { slug } });
  if (!room) notFound();

  const hoursLabel =
    room.dayStartHour === 0 && room.dayEndHour === 24
      ? "Whole day"
      : `${String(room.dayStartHour).padStart(2, "0")}:00–${String(
          room.dayEndHour,
        ).padStart(2, "0")}:00`;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">
        {room.title || "Untitled room"}
      </h1>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm text-foreground/80">
        <dt className="text-foreground/50">Dates</dt>
        <dd>
          {formatDate(room.startDate)} – {formatDate(room.endDate)}
        </dd>
        <dt className="text-foreground/50">Hours</dt>
        <dd>{hoursLabel}</dd>
        <dt className="text-foreground/50">Timezone</dt>
        <dd>{room.timezone}</dd>
      </dl>
      <p className="mt-8 rounded-md border border-dashed border-black/15 px-4 py-6 text-sm text-foreground/60 dark:border-white/15">
        Joining and marking availability lands in the next milestone (M2).
        For now, this confirms the room and its shareable link exist.
      </p>
    </div>
  );
}
