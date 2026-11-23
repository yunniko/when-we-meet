import Image from "next/image";
import { getTranslations } from "next-intl/server";
import heroImage from "@/assets/hero-when-we-meet.jpg";
import { Panel } from "@/components/layout/panel";
import { CreateRoomForm } from "./create-room-form";

export async function Landing() {
  const t = await getTranslations("Landing");
  return (
    <div className="flex flex-1 justify-center px-4 py-10 sm:py-14">
      <main className="w-full max-w-xl">
        {/* Not translated: the lettering is baked into the hero image itself, and the product name is a proper noun. */}
        <h1 className="sr-only">When We Meet</h1>
        <div className="overflow-hidden rounded-2xl border border-border shadow-sm">
          <Image src={heroImage} alt={t("heroAlt")} priority sizes="(min-width: 640px) 576px, 100vw" className="h-auto w-full" />
        </div>
        <p className="mt-5 text-center text-sm text-text-muted">{t("tagline")}</p>
        <Panel padding="roomy" className="mt-6">
          <CreateRoomForm />
        </Panel>
      </main>
    </div>
  );
}
