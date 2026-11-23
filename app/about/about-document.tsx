import { getTranslations } from "next-intl/server";
import { TextLink } from "@/components/layout/text-link";
import { legalDocHtml } from "@/lib/legal";

// The about, terms and privacy document, rendered from our own markdown (docs/legal), with no user input involved.
export async function AboutDocument() {
  const t = await getTranslations("About");
  const html = await legalDocHtml();
  return (
    <>
      <TextLink href="/" size="sm">
        ← {t("backHome")}
      </TextLink>
      <p className="mt-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{t("draftBanner")}</p>
      <article
        className="legal-doc mt-4 text-sm leading-relaxed [&_a]:text-accent [&_a]:underline [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:font-medium [&_li]:my-1 [&_li]:ml-5 [&_li]:list-disc [&_ol_li]:list-decimal [&_p]:my-3"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
}
