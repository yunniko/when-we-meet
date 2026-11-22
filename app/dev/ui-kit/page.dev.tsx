// The kit's kitchen sink, for review screenshots. Development only: the `.dev.tsx` extension is a page only when
// next.config.ts adds it (never in `next build`), and `npm run build:check` proves the build has no trace of it.
import { ToastProvider } from "@/components/ui-kit";
import { KitchenSink } from "@/components/ui-kit/kitchen-sink";

export default function UiKitPage() {
  return (
    <main className="mx-auto max-w-2xl p-4">
      <ToastProvider dismissLabel="Dismiss">
        <KitchenSink />
      </ToastProvider>
    </main>
  );
}
