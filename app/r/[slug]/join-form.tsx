"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { joinRoom, type JoinState } from "@/app/r/[slug]/actions";
import { formatDayLabel } from "@/lib/slots";
import { MAX_PARTICIPANTS_PER_ROOM } from "@/lib/validation";

const initialState: JoinState = { step: "form" };

export function JoinForm({
  roomId,
  slug,
  roomTitle,
  roomDescription,
  dateRangeLabel,
  hoursLabel,
  timezone,
  participantNames,
}: {
  roomId: string;
  slug: string;
  roomTitle: string | null;
  roomDescription: string | null;
  dateRangeLabel: string;
  hoursLabel: string;
  timezone: string;
  participantNames: string[];
}) {
  const t = useTranslations("JoinForm");
  const tCommon = useTranslations("Common");
  const boundJoin = joinRoom.bind(null, { roomId, slug });
  const [state, formAction, pending] = useActionState(boundJoin, initialState);
  const [dismissed, setDismissed] = useState(false);
  const effective: JoinState = dismissed ? initialState : state;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">
        {roomTitle || tCommon("untitledRoom")}
      </h1>
      <p className="mt-1 text-sm text-muted">
        {dateRangeLabel} · {hoursLabel} · {timezone}
      </p>
      {roomDescription && (
        <p className="mt-3 text-sm whitespace-pre-wrap">{roomDescription}</p>
      )}
      <p className="mt-2 text-sm text-muted">{t("intro")}</p>
      {participantNames.length > 0 && (
        <div className="mt-3 text-sm text-muted">
          {t("alreadyInRoom")}{" "}
          {participantNames.map((name, i) => (
            <span key={name}>
              {i > 0 && ", "}
              <form action={formAction} onSubmit={() => setDismissed(false)} className="inline">
                <input type="hidden" name="name" value={name} />
                <button
                  type="submit"
                  className="text-accent underline hover:text-accent-hover"
                  title={t("itsMeTitle", { name })}
                >
                  {name}
                </button>
              </form>
            </span>
          ))}
          {" "}
          {t("clickYourName")}
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        {effective.step === "collision" ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm">
              {t.rich("collision.hasMarks", {
                name: effective.name,
                b: (chunks) => <span className="font-medium">{chunks}</span>,
              })}
            </p>
            {effective.summary.byDate.length > 0 ? (
              <ul className="rounded-md border border-border px-4 py-3 text-sm">
                {effective.summary.byDate.map((d) => (
                  <li key={d.date} className="flex justify-between gap-4">
                    <span>{formatDayLabel(d.date)}</span>
                    <span className="text-muted">
                      {t("collision.summaryLine", { can: d.canCount, cannot: d.cannotCount })}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{t("collision.noMarks")}</p>
            )}
            <p className="text-sm font-medium">{t("collision.isThisYou")}</p>
            <div className="flex gap-3">
              <form action={formAction}>
                <input
                  type="hidden"
                  name="confirmParticipantId"
                  value={effective.participantId}
                />
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
                >
                  {t("collision.yesConfirm")}
                </button>
              </form>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-foreground/5"
              >
                {t("collision.noDifferent")}
              </button>
            </div>
          </div>
        ) : (
          <form
            action={formAction}
            onSubmit={() => setDismissed(false)}
            className="flex flex-col gap-3"
          >
            <label htmlFor="name" className="text-sm font-medium">
              {t("nameLabel")}
            </label>
            <p className="-mt-1.5 text-xs text-muted">{t("nameHelp")}</p>
            <input
              id="name"
              name="name"
              type="text"
              required
              maxLength={60}
              autoFocus
              defaultValue={effective.step === "form" ? effective.name : ""}
              placeholder={t("namePlaceholder")}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
            {effective.step === "form" && effective.error && (
              <p className="text-xs text-red-600">
                {t(`errors.${effective.error}`, { max: MAX_PARTICIPANTS_PER_ROOM })}
              </p>
            )}
            <button
              type="submit"
              disabled={pending}
              className="mt-1 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {pending ? t("submitting") : t("submit")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
