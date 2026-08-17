import Link from "next/link";
import type { CSSProperties } from "react";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentParticipant } from "@/lib/participant";
import { enumerateDates, enumerateHours, formatDateRange, formatDayLabel, formatHour, formatHoursWindow, slotKey } from "@/lib/slots";
import { computeResults, type SlotResult } from "@/lib/results";

function cellStyle(result: SlotResult): CSSProperties {
  const intensity = result.totalParticipants > 0 ? result.canCount / result.totalParticipants : 0;
  return { backgroundColor: `rgba(16, 185, 129, ${intensity.toFixed(3)})` };
}

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const room = await prisma.room.findUnique({ where: { slug } });
  if (!room) notFound();

  const participant = await getCurrentParticipant(room.id);
  if (!participant) redirect(`/r/${slug}`);

  const dates = enumerateDates(room.startDate, room.endDate);
  const hours = enumerateHours(room.dayStartHour, room.dayEndHour);
  const totalParticipants = await prisma.participant.count({ where: { roomId: room.id } });
  const rows = await prisma.availability.findMany({
    where: { participant: { roomId: room.id } },
    select: { slotDate: true, slotHour: true, status: true, preferred: true },
  });

  const results = computeResults(dates, hours, totalParticipants, rows);
  const resultByKey = new Map(results.map((r) => [slotKey(r.date, r.hour), r]));
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
        </div>
        <Link href={`/r/${room.slug}`} className="text-sm font-medium text-accent underline hover:text-accent-hover">
          ← Edit my availability
        </Link>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="mb-6 flex flex-wrap items-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm border border-border" style={{ backgroundColor: "rgba(16,185,129,0.15)" }} />
            fewer can
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm" style={{ backgroundColor: "rgba(16,185,129,1)" }} />
            more can
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm ring-2 ring-amber-400" />
            everyone can
          </span>
          <span className="flex items-center gap-1.5">★N = N prefer this slot</span>
        </div>

        <div className="overflow-x-auto rounded-md border border-border">
          <div
            className="inline-grid select-none"
            style={{ gridTemplateColumns: `72px repeat(${dates.length}, minmax(56px, 1fr))` }}
          >
            <div className="sticky left-0 top-0 z-20 border-b border-r border-border bg-surface" />
            {dates.map((date) => (
              <div
                key={date}
                className="sticky top-0 z-10 border-b border-l border-border bg-surface px-1 py-2 text-center text-xs font-medium"
              >
                {formatDayLabel(date)}
              </div>
            ))}

            {hours.map((hour) => (
              <div key={`row-${hour}`} className="contents">
                <div className="sticky left-0 z-10 border-r border-t border-border bg-surface px-2 py-1.5 text-right text-xs text-muted">
                  {formatHour(hour)}
                </div>
                {dates.map((date) => {
                  const key = slotKey(date, hour);
                  const result = resultByKey.get(key);
                  if (!result) return <div key={key} className="h-10 border-l border-t border-border" />;
                  return (
                    <div
                      key={key}
                      title={`${result.canCount}/${result.totalParticipants} can${
                        result.preferredCount > 0 ? `, ${result.preferredCount} prefer` : ""
                      }${result.cannotCount > 0 ? `, ${result.cannotCount} can't` : ""}`}
                      style={cellStyle(result)}
                      className={`relative h-10 border-l border-t border-border ${
                        result.isFullGroup ? "ring-2 ring-inset ring-amber-400" : ""
                      }`}
                    >
                      {result.preferredCount > 0 && (
                        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-medium text-emerald-950">
                          ★{result.preferredCount}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <h2 className="mt-8 mb-3 text-sm font-semibold">Best times</h2>
        {topResults.length === 0 ? (
          <p className="text-sm text-muted">
            Nobody has marked any slots as available yet.
          </p>
        ) : (
          <ol className="flex flex-col gap-1.5 text-sm">
            {topResults.map((r) => (
              <li key={slotKey(r.date, r.hour)} className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2">
                <span>
                  {formatDayLabel(r.date)}, {formatHour(r.hour)}–{formatHour(r.hour + 1)}
                </span>
                <span className="text-muted">
                  {r.canCount}/{r.totalParticipants} can
                  {r.isFullGroup && (
                    <span className="ml-1.5 rounded-full bg-amber-400/20 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                      everyone
                    </span>
                  )}
                  {r.preferredCount > 0 && ` · ★${r.preferredCount} prefer`}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
