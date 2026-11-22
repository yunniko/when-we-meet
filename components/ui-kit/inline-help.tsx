"use client";
// Detail on demand (COMPANY/UI_STANDARDS.md §3: detail). The text stays out of the page until asked for, then opens
// in the top layer beside its button, so nothing moves. A native popover: Escape and a click outside close it.
import { useEffect, useId, useRef, type ReactNode } from "react";

export type InlineHelpProps = {
  /** The button's name, e.g. "About time zones". */
  label: string;
  children: ReactNode;
};

export function InlineHelp({ label, children }: InlineHelpProps) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    // Placed before it is shown (beforetoggle), so it never appears elsewhere first and then moves. It has no
    // size yet, so the edge clamp uses its maximum width.
    const place = (e: Event) => {
      if ((e as ToggleEvent).newState !== "open" || !button.current) return;
      const r = button.current.getBoundingClientRect();
      const width = Math.min(parseFloat(getComputedStyle(el).maxWidth) || 320, window.innerWidth - 16);
      el.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - width - 8))}px`;
      el.style.top = `${r.bottom + 4}px`;
    };
    el.addEventListener("beforetoggle", place);
    return () => el.removeEventListener("beforetoggle", place);
  }, []);
  return (
    <>
      <button
        ref={button}
        type="button"
        popoverTarget={id}
        aria-label={label}
        aria-describedby={id}
        // 24px to see, 44px to hit (§4): the ::after extends the target by 10px on each side.
        className="relative inline-grid size-6 place-items-center rounded-full border border-border bg-surface-raised align-middle text-sm text-text-muted after:absolute after:-inset-2.5 focus-visible:outline-2 focus-visible:outline-focus"
      >
        <span aria-hidden>?</span>
      </button>
      <div
        ref={panel}
        id={id}
        popover="auto"
        className="fixed m-0 max-w-xs rounded-md border border-border bg-surface-raised p-2 text-sm text-text shadow-raised"
      >
        {children}
      </div>
    </>
  );
}
