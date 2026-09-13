"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { removeParticipant, type RemoveParticipantResult } from "@/app/r/[slug]/actions";
import { confirmationMatches } from "@/lib/roster";

type ErrorKey = Extract<RemoveParticipantResult, { ok: false }>["error"] | "failed";

// Owner-only list of everyone in the room with type-to-confirm removal
// (G-003). The disabled button is the UI gate; the form's submit handler
// deliberately does not re-check the name, so the server's own check is
// the authority and is what the e2e spec exercises.
export function ParticipantsPanel({
  roomId,
  slug,
  ownerName,
  others,
}: {
  roomId: string;
  slug: string;
  ownerName: string;
  others: { id: string; name: string }[];
}) {
  const t = useTranslations("ParticipantsPanel");
  const router = useRouter();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  // Shown inside the open confirmation.
  const [formError, setFormError] = useState<ErrorKey | null>(null);
  // Shown above the list, for outcomes that close the confirmation.
  const [notice, setNotice] = useState<{ key: ErrorKey; name: string } | null>(null);

  function open(id: string) {
    setConfirmingId(id);
    setTyped("");
    setFormError(null);
    setNotice(null);
  }

  function close() {
    setConfirmingId(null);
    setTyped("");
    setFormError(null);
  }

  // Cancel returns keyboard focus to the row's Remove button, which only
  // exists again after the confirmation unmounts.
  function cancel() {
    const returnTo = confirmingId;
    close();
    if (returnTo) {
      requestAnimationFrame(() => document.getElementById(`remove-open-${returnTo}`)?.focus());
    }
  }

  async function submit(target: { id: string; name: string }) {
    setPending(true);
    setFormError(null);
    try {
      const res = await removeParticipant(
        { roomId, slug },
        { participantId: target.id, typedName: typed },
      );
      if (res.ok) {
        close();
        router.refresh();
      } else if (res.error === "notFound") {
        // They left (or someone else removed them) meanwhile: the list is
        // stale, so refresh it and say what happened.
        close();
        setNotice({ key: "notFound", name: target.name });
        router.refresh();
      } else {
        // notOwner / roomGone: not refreshed automatically, so the message
        // stays readable instead of the panel vanishing without a word.
        setFormError(res.error);
      }
    } catch {
      setFormError("failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      aria-labelledby="participants-heading"
      className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-sm"
    >
      <h2 id="participants-heading" className="text-sm font-semibold">
        {t("heading")}
      </h2>
      <p className="mt-1 text-xs text-muted">{t("ownerHint")}</p>

      {notice && (
        <p role="status" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {t(`errors.${notice.key}`, { name: notice.name })}
        </p>
      )}

      <ul className="mt-3 flex flex-col divide-y divide-border">
        <li className="py-2 text-sm break-words">{t("you", { name: ownerName })}</li>
        {others.map((p) => {
          const isOpen = confirmingId === p.id;
          const matches = confirmationMatches(typed, p.name);
          const inputId = `remove-confirm-${p.id}`;
          return (
            <li key={p.id} className="py-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 break-words">{p.name}</span>
                {!isOpen && (
                  <button
                    id={`remove-open-${p.id}`}
                    type="button"
                    onClick={() => open(p.id)}
                    aria-label={t("removeLabel", { name: p.name })}
                    className="shrink-0 px-1 py-1 text-xs text-red-600 underline hover:text-red-700"
                  >
                    {t("remove")}
                  </button>
                )}
              </div>
              {isOpen && (
                <form
                  data-testid="remove-confirm-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submit(p);
                  }}
                  className="mt-2 flex flex-col gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2"
                >
                  <p className="text-xs text-red-700 break-words">{t("warning", { name: p.name })}</p>
                  <label htmlFor={inputId} className="text-xs font-medium break-words">
                    {t("typeToConfirm", { name: p.name })}
                  </label>
                  <input
                    id={inputId}
                    type="text"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    autoFocus
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={80}
                    // 16px on phones so iOS doesn't zoom the page on focus.
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-base outline-none focus:border-accent sm:text-sm"
                  />
                  {formError && (
                    <p role="alert" className="text-xs font-medium text-red-700">
                      {t(`errors.${formError}`, { name: p.name })}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={!matches || pending}
                      className="max-w-full rounded-md bg-red-600 px-2.5 py-1.5 text-left text-xs font-medium break-words text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {pending ? t("removing") : t("confirm", { name: p.name })}
                    </button>
                    <button
                      type="button"
                      onClick={cancel}
                      className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium hover:bg-foreground/5"
                    >
                      {t("cancel")}
                    </button>
                  </div>
                </form>
              )}
            </li>
          );
        })}
      </ul>
      {others.length === 0 && <p className="mt-1 text-sm text-muted">{t("nobodyElse")}</p>}
    </section>
  );
}
