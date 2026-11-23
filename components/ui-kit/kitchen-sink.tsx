"use client";
// The ui-kit page (COMPANY/UI_STANDARDS.md §2): every kit component in every state, then every project component
// in the states its `.states.tsx` file lists (ui-kit D010). States are drawn side by side, never reached by
// clicking, so a review sees each one at a glance; the interactive section at the end is for the e2e suite. Its
// root carries SINK_MARKER, which `build-clean` looks for in production builds: it must never ship. The sample
// text is fixed English on purpose; it shows components, not the project's copy.
import { useState, type ReactNode } from "react";
import { Button, linkClass, type ButtonVariant } from "./button";
import { ConfirmDialog } from "./confirm-dialog";
import { EmptyState } from "./empty-state";
import { Field, controlClass } from "./field";
import { Choice, FieldGroup } from "./field-group";
import { InlineHelp } from "./inline-help";
import { StatusSlot, type StatusTone } from "./status-slot";
import { useToast } from "./toast";
import { StateFrame, UiPageSections, type UiPageSection } from "./ui-page";

export const SINK_MARKER = "data-ui-kit-sink";

const NAME_ERRORS = { empty: "Enter a name.", long: "Room names can be at most 20 characters, so they fit on a phone screen." };
const ERROR = "Enter a valid value.";

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="flex flex-col gap-3 rounded-md border border-border bg-surface-raised p-4">
      <h2 className="m-0 text-lg">{title}</h2>
      {children}
    </section>
  );
}

// Each control type the kit draws (PAGE_CONTROLS in scripts/lib/ui-page.mjs; ui-check fails on any other).
const TEXT_CONTROLS: { type: string; value: string }[] = [
  { type: "text", value: "Team dinner" },
  { type: "email", value: "anna@example.com" },
  { type: "number", value: "18" },
  { type: "date", value: "2027-03-10" },
  { type: "time", value: "18:00" },
  { type: "search", value: "Prague" },
];
type ControlState = "idle" | "error" | "disabled";
const CONTROL_STATES: ControlState[] = ["idle", "error", "disabled"];

function ControlInState({ type, value, state }: { type: string; value: string; state: ControlState }) {
  return (
    <Field label={`${type}, ${state}`} error={state === "error" ? ERROR : null} reserve={[ERROR]}>
      {(p) =>
        type === "select" ? (
          <select {...p} className={controlClass} defaultValue="b" disabled={state === "disabled"}>
            <option value="a">Europe / London</option>
            <option value="b">Europe / Prague</option>
          </select>
        ) : type === "textarea" ? (
          <textarea {...p} className={controlClass} rows={2} defaultValue={"Anna\nBoris"} disabled={state === "disabled"} />
        ) : (
          <input {...p} className={controlClass} type={type} defaultValue={value} disabled={state === "disabled"} />
        )
      }
    </Field>
  );
}

function StaticStates() {
  const variants: ButtonVariant[] = ["primary", "secondary", "danger", "link"];
  const tones: StatusTone[] = ["neutral", "success", "danger"];
  return (
    <>
      <Section id="fields" title="Field">
        <StateFrame name="label only">
          <Field label="Room name">{(p) => <input {...p} className={controlClass} />}</Field>
        </StateFrame>
        <StateFrame name="hint, inline help">
          <Field
            label="Room name"
            hint="Shown to everyone you invite"
            labelExtra={<InlineHelp label="About room names">Anyone with the link sees it.</InlineHelp>}
          >
            {(p) => <input {...p} className={controlClass} />}
          </Field>
        </StateFrame>
        <StateFrame name="error in the hint's place">
          <Field label="Room name" hint="Shown to everyone you invite" error={NAME_ERRORS.empty} reserve={[NAME_ERRORS.empty]}>
            {(p) => <input {...p} className={controlClass} />}
          </Field>
        </StateFrame>
      </Section>

      <Section id="controls" title="Controls">
        {[...TEXT_CONTROLS, { type: "select", value: "" }, { type: "textarea", value: "" }].map(({ type, value }) => (
          <div key={type} className="grid gap-3 sm:grid-cols-3">
            {CONTROL_STATES.map((state) => (
              <ControlInState key={state} type={type} value={value} state={state} />
            ))}
          </div>
        ))}
      </Section>

      <Section id="choices" title="FieldGroup and Choice">
        <StateFrame name="radio: hint, one checked, one disabled">
          <FieldGroup legend="Who can join" hint="You can always join your own room">
            <Choice type="radio" name="s-rule" defaultChecked>
              Anyone with the link
            </Choice>
            <Choice type="radio" name="s-rule">
              Only invited names
            </Choice>
            <Choice type="radio" name="s-rule" disabled>
              Nobody (disabled)
            </Choice>
          </FieldGroup>
        </StateFrame>
        <StateFrame name="radio: error">
          <FieldGroup legend="Who can join" error="Pick who can join." reserve={["Pick who can join."]}>
            <Choice type="radio" name="s-rule-error">
              Anyone with the link
            </Choice>
            <Choice type="radio" name="s-rule-error">
              Only invited names
            </Choice>
          </FieldGroup>
        </StateFrame>
        <StateFrame name="checkbox: unchecked, checked, disabled">
          <FieldGroup legend="Notify me">
            <Choice type="checkbox">When someone joins</Choice>
            <Choice type="checkbox" defaultChecked>
              When a time is picked
            </Choice>
            <Choice type="checkbox" disabled>
              By text message (disabled)
            </Choice>
          </FieldGroup>
        </StateFrame>
      </Section>

      <Section id="buttons" title="Button">
        {variants.map((variant) => (
          <div key={variant} className="flex flex-wrap items-center gap-2">
            <Button variant={variant}>{variant}</Button>
            <Button variant={variant} disabled>
              disabled
            </Button>
            <Button variant={variant} busy busyLabel="Working">
              busy
            </Button>
          </div>
        ))}
        <StateFrame name="router link (linkClass)">
          <a href="#buttons" className={linkClass}>
            See results
          </a>
        </StateFrame>
      </Section>

      <Section id="status" title="StatusSlot">
        {tones.map((tone) => (
          <StateFrame key={tone} name={tone}>
            <StatusSlot message={tone === "danger" ? "Couldn't save. Try again." : tone === "success" ? "Saved" : "Saving…"} tone={tone} />
          </StateFrame>
        ))}
        <StateFrame name="empty (reserves its line)">
          <StatusSlot message={null} reserve={["Saved"]} />
        </StateFrame>
      </Section>

      <Section id="empty" title="EmptyState">
        <EmptyState title="No times marked yet" body="Marked times appear here." action={<Button variant="secondary">Mark times</Button>} />
        <EmptyState title="Nobody has joined" body="Share the link to invite people." />
      </Section>
    </>
  );
}

function Interactive() {
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
    if (!name.trim() || name.length > 20) {
      setNameError(name.trim() ? NAME_ERRORS.long : NAME_ERRORS.empty);
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
    <Section id="interactive" title="Interactive (for the e2e suite)">
      <Field
        label="Room name"
        hint="Shown to everyone you invite"
        error={nameError}
        reserve={Object.values(NAME_ERRORS)}
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
      <FieldGroup legend="Who can join" hint="You can always join your own room" error={ruleError}>
        {["Anyone with the link", "Only invited names"].map((label) => (
          <Choice key={label} type="radio" name="rule" checked={rule === label} onChange={() => (setRule(label), setRuleError(null))}>
            {label}
          </Choice>
        ))}
      </FieldGroup>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => setRuleError(rule ? null : "Pick who can join.")} data-testid="check-rule">
          Check
        </Button>
        <Button variant="secondary" onClick={() => toast("Link copied", "success")} data-testid="copy">
          Copy link
        </Button>
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
  );
}

/** The ui-kit page. `sections` are the project's states files, rendered by `renderSections` on the server. */
export function KitchenSink({ sections = [], children }: { sections?: UiPageSection[]; children?: ReactNode }) {
  const contents = [
    ["fields", "Field"],
    ["controls", "Controls"],
    ["choices", "Choices"],
    ["buttons", "Button"],
    ["status", "StatusSlot"],
    ["empty", "EmptyState"],
    ...sections.map((s) => [s.title, s.title]),
    ["interactive", "Interactive"],
  ];
  return (
    <main {...{ [SINK_MARKER]: "" }} className="mx-auto flex max-w-2xl flex-col gap-4 bg-background p-4 font-body text-text">
      <h1 className="m-0 text-lg">ui-kit page</h1>
      <nav aria-label="Contents" className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
        {contents.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="text-accent underline">
            {label}
          </a>
        ))}
      </nav>
      <StaticStates />
      <UiPageSections sections={sections} />
      {children}
      <Interactive />
    </main>
  );
}
