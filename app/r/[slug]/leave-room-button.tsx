"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { leaveRoom } from "@/app/r/[slug]/actions";
import type { JoinRuleValue } from "@/lib/roster";

export function LeaveRoomButton({
  roomId,
  slug,
  joinRule,
}: {
  roomId: string;
  slug: string;
  // Under "listed names only" leaving deletes marks but keeps the name on
  // the invite list (G-004), so the warning differs. The request carries the
  // rule the warning described; if the owner changed it since this page
  // loaded, the server refuses and the page refreshes to the new wording.
  joinRule: JoinRuleValue;
}) {
  const t = useTranslations("LeaveRoom");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [ruleChanged, setRuleChanged] = useState(false);
  const [isPending, startTransition] = useTransition();
  const keepsName = joinRule === "LISTED_ONLY";

  function confirm() {
    setRuleChanged(false);
    startTransition(async () => {
      // Success redirects to the join form; only a refusal comes back.
      const res = await leaveRoom({ roomId, slug, expectedRule: joinRule });
      if (res && !res.ok) {
        setRuleChanged(true);
        router.refresh();
      }
    });
  }

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
      {ruleChanged && (
        <p role="alert" className="text-xs font-medium text-red-700">
          {t("ruleChanged")}
        </p>
      )}
      <p className="text-xs text-red-700">{t(keepsName ? "warningKeepsName" : "warning")}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={confirm}
          disabled={isPending}
          className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {t(keepsName ? "confirmKeepsName" : "confirm")}
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setRuleChanged(false);
          }}
          className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium hover:bg-foreground/5"
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
