"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  addInvitedNames,
  changeJoinRule,
  removeInvitedName,
  removeParticipant,
  type AddInvitedNamesResult,
  type ChangeJoinRuleResult,
  type RemoveInvitedNameResult,
  type RemoveParticipantResult,
} from "@/app/r/[slug]/actions";
import { confirmationMatches, type JoinRuleValue } from "@/lib/roster";

type ErrorOf<T> = T extends { ok: false; error: infer E } ? E : never;
type ErrorKey =
  | ErrorOf<RemoveParticipantResult>
  | ErrorOf<RemoveInvitedNameResult>
  | ErrorOf<AddInvitedNamesResult>
  | ErrorOf<ChangeJoinRuleResult>
  | "failed"
  | "addFailed"
  | "ruleFailed";

// `invited`: a name nobody has claimed; `left`: an invited name whose holder
// left a listed-only room (G-004, D013).
type Other = { id: string; name: string; invited: boolean; left: boolean };

const JOIN_RULES: JoinRuleValue[] = ["ANYONE", "LISTED_ONLY"];

// Owner-only panel (G-003, G-004): everyone in the room, removal, the invited
// list and the join rule. Removing someone who has joined needs their name
// typed: the disabled button is the UI gate and the server re-checks the
// name, which the e2e spec exercises. An unclaimed invited name loses
// nothing, so it goes in one click; if someone claimed it meanwhile the
// server refuses and the typed confirmation opens instead.
export function ParticipantsPanel({
  roomId,
  slug,
  ownerName,
  others,
  joinRule,
}: {
  roomId: string;
  slug: string;
  ownerName: string;
  others: Other[];
  joinRule: JoinRuleValue;
}) {
  const t = useTranslations("ParticipantsPanel");
  const router = useRouter();
  const ctx = { roomId, slug };

  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  // Shown inside the open confirmation.
  const [formError, setFormError] = useState<ErrorKey | null>(null);
  // Shown above the list, for outcomes of a removal.
  const [notice, setNotice] = useState<{ key: ErrorKey; name: string } | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const [addText, setAddText] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<ErrorKey | null>(null);
  const [addResult, setAddResult] = useState<{ added: number; skipped: string[] } | null>(null);

  // The rule just chosen, shown until the saved rule arrives from the
  // server. When the saved rule changes (this change or another session's),
  // the pending choice is dropped during render, React's pattern for
  // resetting state on a prop change, so an open confirmation survives.
  const [chosenRule, setChosenRule] = useState<JoinRuleValue | null>(null);
  const [ruleError, setRuleError] = useState<ErrorKey | null>(null);
  const [savedRule, setSavedRule] = useState(joinRule);
  if (savedRule !== joinRule) {
    setSavedRule(joinRule);
    setChosenRule(null);
  }
  const shownRule = chosenRule ?? joinRule;

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
    setNotice(null);
    if (returnTo) {
      requestAnimationFrame(() => document.getElementById(`remove-open-${returnTo}`)?.focus());
    }
  }

  async function submit(target: Other) {
    setPending(true);
    setFormError(null);
    try {
      const res = await removeParticipant(ctx, { participantId: target.id, typedName: typed });
      if (res.ok) {
        close();
        setNotice(null);
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

  async function removeInvited(target: Other) {
    setNotice(null);
    setRemovingId(target.id);
    try {
      const res = await removeInvitedName(ctx, target.id);
      if (res.ok) {
        router.refresh();
      } else if (res.error === "claimed") {
        // Claimed since this list loaded: removing them now deletes marks,
        // so ask for the typed confirmation instead.
        open(target.id);
        setNotice({ key: "claimed", name: target.name });
        router.refresh();
      } else {
        setNotice({ key: res.error, name: target.name });
        if (res.error === "notFound") router.refresh();
      }
    } catch {
      setNotice({ key: "failed", name: target.name });
    } finally {
      setRemovingId(null);
    }
  }

  async function addNames() {
    setAdding(true);
    setAddError(null);
    setAddResult(null);
    try {
      const res = await addInvitedNames(ctx, addText);
      if (res.ok) {
        setAddText("");
        setAddResult({ added: res.added.length, skipped: res.skipped });
        router.refresh();
      } else {
        setAddError(res.error);
      }
    } catch {
      setAddError("addFailed");
    } finally {
      setAdding(false);
    }
  }

  async function chooseRule(rule: JoinRuleValue) {
    setChosenRule(rule);
    setRuleError(null);
    try {
      const res = await changeJoinRule(ctx, rule);
      if (res.ok) {
        router.refresh();
      } else {
        setChosenRule(null);
        setRuleError(res.error);
      }
    } catch {
      setChosenRule(null);
      setRuleError("ruleFailed");
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
        <p role="status" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm wrap-anywhere text-red-700">
          {t(`errors.${notice.key}`, { name: notice.name })}
        </p>
      )}

      <ul className="mt-3 flex flex-col divide-y divide-border">
        <li className="py-2 text-sm wrap-anywhere">{t("you", { name: ownerName })}</li>
        {others.map((p) => {
          const isOpen = confirmingId === p.id;
          const matches = confirmationMatches(typed, p.name);
          const inputId = `remove-confirm-${p.id}`;
          return (
            <li key={p.id} className="py-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2">
                  <span className="min-w-0 wrap-anywhere">{p.name}</span>
                  {p.invited && (
                    <span className="rounded-full bg-foreground/5 px-1.5 py-0.5 text-[11px] text-muted">
                      {t(p.left ? "leftTag" : "notJoinedTag")}
                    </span>
                  )}
                </div>
                {!isOpen && (
                  <button
                    id={`remove-open-${p.id}`}
                    type="button"
                    onClick={() => {
                      if (p.invited) void removeInvited(p);
                      else open(p.id);
                    }}
                    disabled={removingId === p.id}
                    aria-label={t("removeLabel", { name: p.name })}
                    className="shrink-0 px-1 py-1 text-xs text-red-600 underline hover:text-red-700 disabled:opacity-50"
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
                  <p className="text-xs wrap-anywhere text-red-700">{t("warning", { name: p.name })}</p>
                  <label htmlFor={inputId} className="text-xs font-medium wrap-anywhere">
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
                      className="max-w-full rounded-md bg-red-600 px-2.5 py-1.5 text-left text-xs font-medium wrap-anywhere text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
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

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void addNames();
        }}
        className="mt-5 flex flex-col gap-1.5 border-t border-border pt-4"
      >
        <label htmlFor="add-invited-names" className="text-sm font-medium">
          {t("addLabel")}
        </label>
        <textarea
          id="add-invited-names"
          rows={3}
          value={addText}
          onChange={(e) => setAddText(e.target.value)}
          // Read-only while saving: a successful add clears the box, which
          // would otherwise also wipe anything typed in the meantime.
          readOnly={adding}
          aria-describedby="add-invited-help"
          aria-invalid={addError ? true : undefined}
          className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-base outline-none focus:border-accent sm:text-sm"
        />
        <p id="add-invited-help" className="text-xs text-muted">
          {t("addHelp")}
        </p>
        {addError && (
          <p role="alert" className="text-xs font-medium text-red-700">
            {t(`errors.${addError}`, { name: "" })}
          </p>
        )}
        {addResult && (
          <p role="status" className="text-xs wrap-anywhere text-muted">
            {t("addedResult", { count: addResult.added })}
            {addResult.skipped.length > 0 && (
              <> {t("skippedResult", { names: addResult.skipped.join(", ") })}</>
            )}
          </p>
        )}
        <div>
          <button
            type="submit"
            disabled={adding || !addText.trim()}
            className="rounded-md border border-accent px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
          >
            {adding ? t("adding") : t("addButton")}
          </button>
        </div>
      </form>

      <div className="mt-5 border-t border-border pt-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">{t("joinRuleLegend")}</legend>
          {JOIN_RULES.map((rule) => (
            <label key={rule} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="panel-join-rule"
                value={rule}
                checked={shownRule === rule}
                onChange={() => void chooseRule(rule)}
                className="size-4 accent-accent"
              />
              {rule === "ANYONE" ? t("joinRuleAnyone") : t("joinRuleListedOnly")}
            </label>
          ))}
          {ruleError && (
            <p role="alert" className="text-xs font-medium text-red-700">
              {t(`errors.${ruleError}`, { name: "" })}
            </p>
          )}
        </fieldset>
      </div>
    </section>
  );
}
