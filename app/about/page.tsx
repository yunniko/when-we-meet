import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { legalDocHtml } from "@/lib/legal";

const baseUrl = process.env.APP_URL || "http://localhost:3000";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("About");
  return { title: t("pageTitle"), description: t("pageDescription") };
}

// Minimal WebPage structured data — no schema.org type fits a combined
// about/terms/privacy document well, so this just names the page.
const webPageJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "About, Terms of Use & Privacy",
  url: `${baseUrl}/about`,
};

export default async function AboutPage() {
  const t = await getTranslations("About");
  const html = await legalDocHtml();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }}
      />
      <Link href="/" className="text-sm font-medium text-accent underline hover:text-accent-hover">
        ← {t("backHome")}
      </Link>
      <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        {t("draftBanner")}
      </p>
      <article
        className="legal-doc mt-4 text-sm leading-relaxed [&_a]:text-accent [&_a]:underline [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:font-medium [&_li]:my-1 [&_li]:ml-5 [&_li]:list-disc [&_ol_li]:list-decimal [&_p]:my-3"
        // Our own repo markdown (docs/legal), no user input involved.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
