"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { deselectFinalSlot } from "@/app/r/[slug]/actions";
import { formatDayLabel, formatHour } from "@/lib/slots";

export function FinalizedBanner({
  roomId,
  slug,
  date,
  hour,
  isOwner,
}: {
  roomId: string;
  slug: string;
  date: string;
  hour: number;
  isOwner: boolean;
}) {
  const t = useTranslations("FinalizedBanner");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const when = `${formatDayLabel(date)}, ${formatHour(hour)}–${formatHour((hour + 1) % 24)}`;

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-accent bg-accent/10 px-5 py-4 shadow-sm">
      <p className="text-base font-semibold">{t("title", { when })}</p>
      {isOwner && (
        <button
          type="button"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            await deselectFinalSlot({ roomId, slug });
            router.refresh();
            setPending(false);
          }}
          className="rounded-md border border-accent bg-surface px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
        >
          {pending ? t("clearing") : t("clear")}
        </button>
      )}
    </div>
  );
}
