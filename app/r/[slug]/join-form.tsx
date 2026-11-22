"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { joinRoom, type JoinState } from "@/app/r/[slug]/actions";
import { formatDayLabel } from "@/lib/slots";
import { MAX_PARTICIPANTS_PER_ROOM } from "@/lib/validation";
import { Button, Field, controlClass } from "@/components/ui-kit";

const initialState: JoinState = { step: "form" };

export function JoinForm({
  roomId,
  slug,
  roomTitle,
  roomDescription,
  dateRangeLabel,
  hoursLabel,
  timezone,
  joinedNames,
  invitedNames,
  listedOnly,
  canUseAnyName,
}: {
  roomId: string;
  slug: string;
  roomTitle: string | null;
  roomDescription: string | null;
  dateRangeLabel: string;
  hoursLabel: string;
  timezone: string;
  // Other people who have joined, and invited names nobody has claimed yet
  // (G-004). Both are tappable "that's me" shortcuts.
  joinedNames: string[];
  invitedNames: string[];
  listedOnly: boolean;
  // This browser created the room, so "listed names only" doesn't bind it.
  canUseAnyName: boolean;
}) {
  const t = useTranslations("JoinForm");
  const tCommon = useTranslations("Common");
  const boundJoin = joinRoom.bind(null, { roomId, slug });
  const [state, formAction, pending] = useActionState(boundJoin, initialState);
  const [dismissed, setDismissed] = useState(false);
  const effective: JoinState = dismissed ? initialState : state;

  // Each name is its own tiny form posting just that name, which leads to the
  // ordinary "is this you?" confirmation (for invited names too).
  const nameButtons = (names: string[]) =>
    names.map((name, i) => (
      <span key={name}>
        {i > 0 && ", "}
        <form action={formAction} onSubmit={() => setDismissed(false)} className="inline">
          <input type="hidden" name="name" value={name} />
          <button type="submit" className="text-accent underline hover:text-accent-hover" title={t("itsMeTitle", { name })}>
            {name}
          </button>
        </form>
      </span>
    ));

  const error = effective.step === "form" && effective.error ? t(`errors.${effective.error}`, { max: MAX_PARTICIPANTS_PER_ROOM }) : null;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">{roomTitle || tCommon("untitledRoom")}</h1>
      <p className="mt-1 text-sm text-text-muted">
        {dateRangeLabel} · {hoursLabel} · {timezone}
      </p>
      {roomDescription && <p className="mt-3 text-sm whitespace-pre-wrap">{roomDescription}</p>}
      {listedOnly && <p className="mt-3 text-sm text-text-muted">{t(canUseAnyName ? "listedOnlyCreatorHint" : "listedOnlyHint")}</p>}
      {(joinedNames.length > 0 || invitedNames.length > 0) && (
        <div className="mt-3 flex flex-col gap-1 text-sm wrap-anywhere text-text-muted">
          {joinedNames.length > 0 && (
            <div>
              {t("alreadyInRoom")}: {nameButtons(joinedNames)}
            </div>
          )}
          {invitedNames.length > 0 && (
            <div>
              {t("invitedLabel")}: {nameButtons(invitedNames)}
            </div>
          )}
          <p>{t("pickYourNameHint")}</p>
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        {effective.step === "collision" ? (
          <div className="flex flex-col gap-4">
            <h2 className="text-base font-medium">{t("collision.isThisYouTitle")}</h2>
            <p className="text-sm wrap-anywhere">
              {t.rich(effective.invited ? "collision.invitedHint" : "collision.hasMarksHint", {
                name: effective.name,
                b: (chunks) => <span className="font-medium">{chunks}</span>,
              })}
            </p>
            {effective.invited ? null : effective.summary.byDate.length > 0 ? (
              <ul className="rounded-md border border-border px-4 py-3 text-sm">
                {effective.summary.byDate.map((d) => (
                  <li key={d.date} className="flex justify-between gap-4">
                    <span>{formatDayLabel(d.date)}</span>
                    <span className="text-text-muted">{t("collision.summaryLine", { can: d.canCount, cannot: d.cannotCount })}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-muted">{t("collision.noMarksHint")}</p>
            )}
            <div className="flex flex-wrap gap-3">
              <form action={formAction}>
                <input type="hidden" name="confirmParticipantId" value={effective.participantId} />
                <Button type="submit" busy={pending} busyLabel={t("submitting")}>
                  {t("collision.yes")}
                </Button>
              </form>
              <Button variant="secondary" onClick={() => setDismissed(true)}>
                {t("collision.noDifferent")}
              </Button>
            </div>
          </div>
        ) : (
          <form action={formAction} onSubmit={() => setDismissed(false)} className="flex flex-col gap-2">
            <Field label={t("nameLabel")} hint={t("nameHint")} error={error}>
              {(p) => (
                <input
                  {...p}
                  name="name"
                  type="text"
                  required
                  maxLength={60}
                  autoFocus
                  defaultValue={effective.step === "form" ? effective.name : ""}
                  placeholder={t("namePlaceholder")}
                  className={controlClass}
                />
              )}
            </Field>
            <Button type="submit" busy={pending} busyLabel={t("submitting")}>
              {t("submit")}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
