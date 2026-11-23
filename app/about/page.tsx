import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageColumn } from "@/components/layout/page-column";
import { AboutDocument } from "./about-document";

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

export default function AboutPage() {
  return (
    <PageColumn width="text">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }} />
      <AboutDocument />
    </PageColumn>
  );
}
