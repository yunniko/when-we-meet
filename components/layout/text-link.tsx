import Link from "next/link";
import type { ReactNode } from "react";
import { linkClass, mutedLinkClass } from "@/components/ui-kit";

// Every text link in the app: the kit's link looks on a router link, in the sizes the pages use.
const SIZES = { xs: "text-xs", sm: "text-sm", base: "" } as const;

export function TextLink({
  href,
  tone = "accent",
  size = "base",
  children,
}: {
  href: string;
  tone?: "accent" | "muted";
  size?: keyof typeof SIZES;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={`${SIZES[size]} ${tone === "muted" ? mutedLinkClass : linkClass}`}>
      {children}
    </Link>
  );
}
