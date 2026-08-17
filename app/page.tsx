import { CreateRoomForm } from "@/app/create-room-form";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <main className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            When We Meet
          </h1>
          <p className="mt-2 text-sm text-foreground/60">
            Pick a date range, share the link, see when everyone&apos;s free.
            No account needed.
          </p>
        </div>
        <CreateRoomForm />
      </main>
    </div>
  );
}
