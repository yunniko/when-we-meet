import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  output: "standalone",
  // `.dev.tsx` pages (the ui-kit kitchen sink) exist only under `next dev`; see app/dev/ui-kit/page.dev.tsx.
  pageExtensions: process.env.NODE_ENV === "production" ? ["tsx", "ts"] : ["dev.tsx", "tsx", "ts"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Nothing about this app benefits from being iframed, and its
          // one-click actions (finalize/clear a meeting time, leave a
          // room) are exactly what clickjacking targets — block framing
          // outright rather than just discouraging it.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
