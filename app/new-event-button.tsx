import Link from "next/link";

export function NewEventButton() {
  return (
    <Link
      href="/"
      className="inline-block rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted hover:border-accent hover:text-accent"
    >
      + New event
    </Link>
  );
}
