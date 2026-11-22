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
import { reserveFor } from "@/lib/message-slots";
import { Button, Choice, ConfirmDialog, EmptyState, Field, FieldGroup, StatusSlot, controlClass } from "@/components/ui-kit";

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

  const target = others.find((p) => p.id === confirmingId) ?? null;
  const matches = target ? confirmationMatches(typed, target.name) : false;
  const addMessage = addResult
    ? [
        t("addedResult", { count: addResult.added }),
        addResult.skipped.length > 0 ? t("skippedResult", { names: addResult.skipped.join(", ") }) : null,
      ]
        .filter(Boolean)
        .join(" ")
    : null;

  return (
    <section aria-labelledby="participants-heading" className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 id="participants-heading" className="text-sm font-semibold">
        {t("heading")}
      </h2>
      {/* One line under the heading: the outcome of a removal when there is one, otherwise who sees this panel. */}
      <StatusSlot
        message={notice ? t(`errors.${notice.key}`, { name: notice.name }) : t("ownerHint")}
        tone={notice ? "danger" : "neutral"}
        reserve={reserveFor(t, "ParticipantsPanel", "notice")}
        className="mt-1 wrap-anywhere"
      />

      <ul className="mt-3 flex flex-col divide-y divide-border">
        <li className="py-2 text-sm wrap-anywhere">{t("you", { name: ownerName })}</li>
        {others.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 py-1 text-sm">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2">
              <span className="min-w-0 wrap-anywhere">{p.name}</span>
              {p.invited && (
                <span className="rounded-full bg-text/5 px-1.5 py-0.5 text-xs text-text-muted">
                  {t(p.left ? "leftTag" : "notJoinedTag")}
                </span>
              )}
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                if (p.invited) void removeInvited(p);
                else open(p.id);
              }}
              busy={removingId === p.id}
              busyLabel={t("removing")}
              aria-label={t("removeLabel", { name: p.name })}
              className="shrink-0"
            >
              {t("remove")}
            </Button>
          </li>
        ))}
      </ul>
      {others.length === 0 && <EmptyState title={t("empty")} />}

      <ConfirmDialog
        open={target != null}
        title={target ? t("removeConfirm.title", { name: target.name }) : ""}
        body={target ? t("removeConfirm.body", { name: target.name }) : ""}
        confirmLabel={target ? t("removeConfirm.action", { name: target.name }) : ""}
        cancelLabel={t("cancel")}
        danger
        busy={pending}
        busyLabel={t("removing")}
        canConfirm={matches}
        onConfirm={() => target && matches && void submit(target)}
        onCancel={() => {
          close();
          setNotice(null);
        }}
      >
        {target && (
          // A real form, so Enter submits; the server re-checks the typed name either way (the e2e spec
          // submits a mismatch past the disabled button to prove it).
          <form
            data-testid="remove-confirm-form"
            onSubmit={(e) => {
              e.preventDefault();
              void submit(target);
            }}
          >
            <Field
              label={t("removeConfirm.typeLabel", { name: target.name })}
              error={formError ? t(`errors.${formError}`, { name: target.name }) : null}
              reserve={reserveFor(t, "ParticipantsPanel", "removeConfirm", { name: target.name })}
            >
              {(f) => (
                <input
                  {...f}
                  type="text"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={80}
                  className={controlClass}
                />
              )}
            </Field>
          </form>
        )}
      </ConfirmDialog>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void addNames();
        }}
        className="mt-5 flex flex-col gap-2 border-t border-border pt-4"
      >
        <Field
          label={t("addLabel")}
          hint={t("addHint")}
          error={addError ? t(`errors.${addError}`, { name: "" }) : null}
          reserve={reserveFor(t, "ParticipantsPanel", "add")}
        >
          {(f) => (
            <textarea
              {...f}
              rows={3}
              value={addText}
              onChange={(e) => setAddText(e.target.value)}
              // Read-only while saving: a successful add clears the box, which would otherwise also wipe
              // anything typed in the meantime.
              readOnly={adding}
              className={`${controlClass} resize-y py-2`}
            />
          )}
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="secondary" busy={adding} busyLabel={t("adding")} aria-disabled={!addText.trim() || undefined}>
            {t("addButton")}
          </Button>
          <StatusSlot message={addMessage} tone="success" className="min-w-0 flex-1 wrap-anywhere" />
        </div>
      </form>

      <div className="mt-5 border-t border-border pt-4">
        <FieldGroup
          legend={t("joinRuleLegend")}
          error={ruleError ? t(`errors.${ruleError}`, { name: "" }) : null}
          reserve={reserveFor(t, "ParticipantsPanel", "joinRule")}
        >
          {JOIN_RULES.map((rule) => (
            <Choice
              key={rule}
              type="radio"
              name="panel-join-rule"
              value={rule}
              checked={shownRule === rule}
              onChange={() => void chooseRule(rule)}
            >
              {rule === "ANYONE" ? t("joinRuleAnyone") : t("joinRuleListedOnly")}
            </Choice>
          ))}
        </FieldGroup>
      </div>
    </section>
  );
}
