"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { leaveRoom } from "@/app/r/[slug]/actions";
import type { JoinRuleValue } from "@/lib/roster";
import { ConfirmDialog, StatusSlot } from "@/components/ui-kit";

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

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="min-h-11 px-1 text-sm text-danger underline hover:text-danger-hover"
      >
        {t("link")}
      </button>
      <ConfirmDialog
        open={confirming}
        title={t("confirm.title")}
        body={t(keepsName ? "confirm.bodyKeepsName" : "confirm.body")}
        confirmLabel={t(keepsName ? "confirm.actionKeepsName" : "confirm.action")}
        cancelLabel={t("cancel")}
        danger
        busy={isPending}
        onConfirm={confirm}
        onCancel={() => {
          setConfirming(false);
          setRuleChanged(false);
        }}
      >
        {/* Reserved whether or not the room's rule changed under the dialog, so the buttons never move. */}
        <StatusSlot message={ruleChanged ? t("errors.ruleChanged") : null} tone="danger" />
      </ConfirmDialog>
    </>
  );
}
