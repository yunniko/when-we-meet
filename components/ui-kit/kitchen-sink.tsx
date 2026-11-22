"use client";
// Every kit component in every state on one page (COMPANY/UI_STANDARDS.md §2), for review screenshots and the e2e
// suite. A project mounts it on a development-only route and adds its own composites as children. Its root carries
// SINK_MARKER, which `build-clean` looks for in production builds: it must never ship. The sample text here is
// fixed English on purpose; it shows components, not the project's copy.
import { useState, type ReactNode } from "react";
import { Button } from "./button";
import { ConfirmDialog } from "./confirm-dialog";
import { EmptyState } from "./empty-state";
import { Field, controlClass } from "./field";
import { Choice, FieldGroup } from "./field-group";
import { InlineHelp } from "./inline-help";
import { StatusSlot } from "./status-slot";
import { useToast } from "./toast";

export const SINK_MARKER = "data-ui-kit-sink";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-md border border-border bg-surface-raised p-4">
      <h2 className="m-0 text-lg">{title}</h2>
      {children}
    </section>
  );
}

export function KitchenSink({ children }: { children?: ReactNode }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleted, setDeleted] = useState<string | null>(null);
  const [rule, setRule] = useState<string | null>(null);
  const [ruleError, setRuleError] = useState<string | null>(null);

  const save = () => {
    if (!name.trim()) {
      setNameError("Enter a name.");
      setStatus(null);
      return;
    }
    setNameError(null);
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setStatus("Saved");
    }, 600);
  };

  return (
    <main {...{ [SINK_MARKER]: "" }} className="mx-auto flex max-w-2xl flex-col gap-4 bg-background p-4 font-body text-text">
      <h1 className="m-0 text-lg">Kitchen sink</h1>

      <Section title="Field">
        <Field
          label="Room name"
          hint="Shown to everyone you invite"
          error={nameError}
          validates
          labelExtra={<InlineHelp label="About room names">Anyone with the link sees it, so avoid private details.</InlineHelp>}
        >
          {(p) => <input {...p} className={controlClass} value={name} onChange={(e) => setName(e.target.value)} data-testid="name" />}
        </Field>
        <Field label="Notes" validates>
          {(p) => <textarea {...p} className={controlClass} rows={2} />}
        </Field>
        <div className="flex items-center gap-4">
          <Button onClick={save} busy={saving} busyLabel="Saving" data-testid="save">
            Save
          </Button>
          <StatusSlot message={status} tone="success" />
        </div>
      </Section>

      <Section title="FieldGroup">
        <FieldGroup legend="Who can join" hint="You can always join your own room" error={ruleError}>
          {["Anyone with the link", "Only invited names"].map((label) => (
            <Choice key={label} type="radio" name="rule" checked={rule === label} onChange={() => (setRule(label), setRuleError(null))}>
              {label}
            </Choice>
          ))}
        </FieldGroup>
        <div>
          <Button variant="secondary" onClick={() => setRuleError(rule ? null : "Pick who can join.")} data-testid="check-rule">
            Check
          </Button>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="danger">Danger</Button>
          <Button busy busyLabel="Working">
            Busy
          </Button>
        </div>
      </Section>

      <Section title="Toast">
        <div>
          <Button variant="secondary" onClick={() => toast("Link copied", "success")} data-testid="copy">
            Copy link
          </Button>
        </div>
      </Section>

      <Section title="Confirm">
        <div className="flex items-center gap-4">
          <Button variant="danger" onClick={() => setConfirmOpen(true)} data-testid="delete">
            Delete room
          </Button>
          <StatusSlot message={deleted} />
        </div>
        <ConfirmDialog
          open={confirmOpen}
          title="Delete this room?"
          body="Everyone loses their marked times. This cannot be undone."
          confirmLabel="Delete"
          cancelLabel="Keep room"
          danger
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => {
            setConfirmOpen(false);
            setDeleted("Room deleted");
          }}
        />
      </Section>

      <Section title="Empty">
        <EmptyState title="No times marked yet" body="Marked times appear here." action={<Button variant="secondary">Mark times</Button>} />
      </Section>

      {children}
    </main>
  );
}
