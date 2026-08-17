"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { leaveRoom } from "@/app/r/[slug]/actions";

export function LeaveRoomButton({ roomId, slug }: { roomId: string; slug: string }) {
  const t = useTranslations("LeaveRoom");
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs text-red-600 underline hover:text-red-700"
      >
        {t("link")}
      </button>
    );
  }

  return (
    <div className="mt-1 flex flex-col items-end gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-2">
      <p className="text-xs text-red-700">{t("warning")}</p>
      <div className="flex gap-2">
        <form action={leaveRoom.bind(null, { roomId, slug })}>
          <button
            type="submit"
            className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700"
          >
            {t("confirm")}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium hover:bg-foreground/5"
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
