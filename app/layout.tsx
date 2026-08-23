import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/app/locale-switcher";
import "./globals.css";

// latin-ext covers Czech/German diacritics, cyrillic covers Russian — the
// default "latin"-only subset would silently fall back to a system font for
// those languages instead of rendering in Geist.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext", "cyrillic"],
});

// Falls back to the local dev port (matches .env.example) when APP_URL is
// unset — same fallback docker-compose.yml already uses for the app's own
// APP_URL default.
const baseUrl = process.env.APP_URL || "http://localhost:3000";

// A dormant seam: set GOOGLE_SITE_VERIFICATION once you've registered the
// site in Search Console (Settings → Ownership verification → "HTML tag"
// gives you this value) and it activates with no further code change.
const verification: Metadata["verification"] = process.env.GOOGLE_SITE_VERIFICATION
  ? { google: process.env.GOOGLE_SITE_VERIFICATION }
  : undefined;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  const title = t("title");
  const description = t("description");
  return {
    metadataBase: new URL(baseUrl),
    title,
    description,
    openGraph: { title, description, url: baseUrl, siteName: title, type: "website" },
    twitter: { card: "summary", title, description },
    ...(verification ? { verification } : {}),
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>
          <div className="flex justify-end px-4 py-2">
            <LocaleSwitcher />
          </div>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
