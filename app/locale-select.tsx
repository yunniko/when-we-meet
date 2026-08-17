"use client";

import { useRef, useTransition } from "react";

// Client half of the language switcher: submits the locale server action on
// change (no separate save button).
export function LocaleSelect({
  current,
  options,
  action,
  label,
}: {
  current: string;
  options: { code: string; label: string }[];
  action: (formData: FormData) => Promise<void>;
  label: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form ref={formRef} action={action}>
      <select
        // Keyed on the server-derived locale: React only applies
        // defaultValue on mount, not on prop updates, so without this key
        // the select would silently revert to the old option after the
        // server action's re-render (translated content updates, dropdown
        // doesn't) — the same class of native-form-reset desync as the
        // create-room preset radios (see create-room-form.tsx), avoided
        // here by forcing a full remount instead of fighting the reset.
        key={current}
        name="locale"
        aria-label={label}
        defaultValue={current}
        disabled={pending}
        onChange={() =>
          startTransition(() => {
            formRef.current?.requestSubmit();
          })
        }
        className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-muted"
      >
        {options.map((o) => (
          <option key={o.code} value={o.code}>
            {o.label}
          </option>
        ))}
      </select>
    </form>
  );
}
