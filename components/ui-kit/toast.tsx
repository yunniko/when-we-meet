"use client";
// Results that belong to no place on the page ("Link copied"). Toasts float over the page, so they never move it,
// and the region is mounted once, so each one is announced. There is no error tone on purpose: an error the person
// must act on is shown where they act, never only in a toast (COMPANY/UI_STANDARDS.md §3).
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "./cx";

export type ToastTone = "neutral" | "success";
type Toast = { id: number; message: string; tone: ToastTone };

const ShowToast = createContext<((message: string, tone?: ToastTone) => void) | null>(null);

/** `const toast = useToast(); toast("Link copied")` inside a ToastProvider. */
export function useToast() {
  const show = useContext(ShowToast);
  if (!show) throw new Error("useToast() needs a <ToastProvider> above it");
  return show;
}

export function ToastProvider({
  children,
  dismissLabel,
  duration = 5000,
}: {
  children: ReactNode;
  dismissLabel: string;
  duration?: number;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  const show = useCallback((message: string, tone: ToastTone = "neutral") => {
    // At most three; the oldest goes first.
    setToasts((list) => [...list.slice(-2), { id: next.current++, message, tone }]);
  }, []);
  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  return (
    <ShowToast.Provider value={show}>
      {children}
      <div role="status" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} duration={duration} dismissLabel={dismissLabel} onDismiss={dismiss} />
        ))}
      </div>
    </ShowToast.Provider>
  );
}

type ToastItemProps = { toast: Toast; duration: number; dismissLabel: string; onDismiss: (id: number) => void };

function ToastItem({ toast, duration, dismissLabel, onDismiss }: ToastItemProps) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => onDismiss(toast.id), duration);
    return () => clearTimeout(timer);
  }, [paused, duration, toast.id, onDismiss]);
  return (
    <div
      className={cx(
        "pointer-events-auto flex max-w-md items-center gap-2 rounded-md bg-text py-1 pr-1 pl-4 text-sm text-surface shadow-raised",
        toast.tone === "success" && "border-l-4 border-success"
      )}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span>{toast.message}</span>
      <button
        type="button"
        aria-label={dismissLabel}
        onClick={() => onDismiss(toast.id)}
        className="grid size-11 place-items-center rounded-md text-base focus-visible:outline-2 focus-visible:outline-focus"
      >
        <span aria-hidden>{"×"}</span>
      </button>
    </div>
  );
}
