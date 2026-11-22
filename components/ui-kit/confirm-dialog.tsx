"use client";
// The one way to ask before something that cannot be undone (COMPANY/UI_STANDARDS.md §3: confirm). A native modal
// <dialog>: the browser traps focus, Escape cancels, and focus returns to the opener on close. Cancel takes focus
// first, so Enter alone never confirms a destructive action.
import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./button";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  /** What will happen, in one or two sentences (confirm cap). */
  body: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  busy?: boolean;
  busyLabel?: string;
  /** False keeps the confirm button inert, e.g. until a name is typed. */
  canConfirm?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Extra content between the body and the buttons, such as a type-to-confirm field. */
  children?: ReactNode;
};

export function ConfirmDialog(props: ConfirmDialogProps) {
  const { open, title, body, confirmLabel, cancelLabel, danger = false, busy = false, busyLabel, canConfirm = true } = props;
  const { onConfirm, onCancel, children } = props;
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-body`}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      className="m-auto max-w-md rounded-md border border-border bg-surface-raised p-4 text-text shadow-raised backdrop:bg-text/40"
    >
      <h2 id={`${id}-title`} className="m-0 text-lg">
        {title}
      </h2>
      <div id={`${id}-body`} className="mt-2 text-base">
        {body}
      </div>
      {children && <div className="mt-4">{children}</div>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" autoFocus onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button
          variant={danger ? "danger" : "primary"}
          onClick={onConfirm}
          busy={busy}
          busyLabel={busyLabel}
          aria-disabled={!canConfirm || undefined}
        >
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
