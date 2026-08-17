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
        <div className="mt-2 text-sm text-muted">
          Already in this room:{" "}
          {participantNames.map((name, i) => (
            <span key={name}>
              {i > 0 && ", "}
              <form action={formAction} onSubmit={() => setDismissed(false)} className="inline">
                <input type="hidden" name="name" value={name} />
                <button
                  type="submit"
                  className="text-accent underline hover:text-accent-hover"
                  title={`It's me — continue as ${name}`}
                >
                  {name}
                </button>
              </form>
            </span>
          ))}
          {" "}— click your name if it&apos;s you.
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        {effective.step === "collision" ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm">
              <span className="font-medium">{effective.name}</span> already has
              marks in this room:
            </p>
            {effective.summary.byDate.length > 0 ? (
              <ul className="rounded-md border border-border px-4 py-3 text-sm">
                {effective.summary.byDate.map((d) => (
                  <li key={d.date} className="flex justify-between gap-4">
                    <span>{formatDayLabel(d.date)}</span>
                    <span className="text-muted">
                      {d.canCount} can · {d.cannotCount} can&apos;t
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">
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
                  className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
                >
                  Yes, that&apos;s me
                </button>
              </form>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-foreground/5"
              >
                No, use a different name
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
              Your name
            </label>
            <p className="-mt-1.5 text-xs text-muted">
              Must be unique in this room. If you come back later on a
              different browser or device to edit your marks, you&apos;ll
              need to enter this same name again.
            </p>
            <input
              id="name"
              name="name"
              type="text"
              required
              maxLength={60}
              autoFocus
              defaultValue={effective.step === "form" ? effective.name : ""}
              placeholder="e.g. Sam"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
            {effective.step === "form" && effective.error && (
              <p className="text-xs text-red-600">{effective.error}</p>
            )}
            <button
              type="submit"
              disabled={pending}
              className="mt-1 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {pending ? "Joining…" : "Join room"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
