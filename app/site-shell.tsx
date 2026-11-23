import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { TextLink } from "@/components/layout/text-link";
import { LocaleSwitcher } from "./locale-switcher";

// What frames every page: the language switcher above, the about link below.
export async function SiteShell({ children }: { children: ReactNode }) {
  const t = await getTranslations("Common");
  return (
    <>
      <div className="flex justify-end px-4 py-2">
        <LocaleSwitcher />
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
      <footer className="px-4 py-4 text-center">
        <TextLink href="/about" tone="muted" size="xs">
          {t("aboutLink")}
        </TextLink>
      </footer>
    </>
  );
}
