"use client";

import { useActionState, useState } from "react";
import { joinRoom, type JoinState } from "@/app/r/[slug]/actions";
import { formatDayLabel } from "@/lib/slots";

const initialState: JoinState = { step: "form" };

export function JoinForm({
  roomId,
  slug,
  roomTitle,
  participantNames,
}: {
  roomId: string;
  slug: string;
  roomTitle: string | null;
  participantNames: string[];
}) {
  const boundJoin = joinRoom.bind(null, { roomId, slug });
  const [state, formAction, pending] = useActionState(boundJoin, initialState);
  const [dismissed, setDismissed] = useState(false);
  const effective: JoinState = dismissed ? initialState : state;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">
        {roomTitle || "Untitled room"}
      </h1>
      {participantNames.length > 0 && (
        <p className="mt-2 text-sm text-foreground/60">
          Already in this room: {participantNames.join(", ")}
        </p>
      )}

      {effective.step === "collision" ? (
        <div className="mt-6 flex flex-col gap-4">
          <p className="text-sm">
            <span className="font-medium">{effective.name}</span> already has
            marks in this room:
          </p>
          {effective.summary.byDate.length > 0 ? (
            <ul className="rounded-md border border-black/10 px-4 py-3 text-sm dark:border-white/15">
              {effective.summary.byDate.map((d) => (
                <li key={d.date} className="flex justify-between gap-4">
                  <span>{formatDayLabel(d.date)}</span>
                  <span className="text-foreground/60">
                    {d.canCount} can · {d.cannotCount} can&apos;t
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-foreground/60">
              No marks yet — just an empty name reservation.
            </p>
          )}
          <p className="text-sm font-medium">Is this you?</p>
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
                className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
              >
                Yes, that&apos;s me
              </button>
            </form>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/5"
            >
              No, use a different name
            </button>
          </div>
        </div>
      ) : (
        <form
          action={formAction}
          onSubmit={() => setDismissed(false)}
          className="mt-6 flex flex-col gap-3"
        >
          <label htmlFor="name" className="text-sm font-medium">
            Your name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            maxLength={60}
            autoFocus
            defaultValue={effective.step === "form" ? effective.name : ""}
            placeholder="e.g. Sam"
            className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/30"
          />
          {effective.step === "form" && effective.error && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {effective.error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="mt-1 rounded-md bg-foreground px-4 py-2.5 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Joining…" : "Join room"}
          </button>
        </form>
      )}
    </div>
  );
}
