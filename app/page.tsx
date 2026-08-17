import Image from "next/image";
import heroImage from "@/assets/hero-when-we-meet.jpg";
import { CreateRoomForm } from "@/app/create-room-form";

export default function Home() {
  return (
    <div className="flex flex-1 justify-center px-4 py-10 sm:py-14">
      <main className="w-full max-w-xl">
        <h1 className="sr-only">When We Meet</h1>
        <div className="overflow-hidden rounded-2xl border border-border shadow-sm">
          <Image
            src={heroImage}
            alt="Four friends raising a toast around a table, with a hand-drawn weekly calendar marked with stars for the times that work"
            priority
            sizes="(min-width: 640px) 576px, 100vw"
            className="w-full h-auto"
          />
        </div>

        <p className="mt-5 text-center text-sm text-muted">
          Pick a date range, share the link, see when everyone&apos;s free.
          No account needed.
        </p>

        <div className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
          <CreateRoomForm />
        </div>
      </main>
    </div>
  );
}
