import type { MetadataRoute } from "next";

// Without this, Next prerenders robots.txt at Docker *build* time and bakes
// in whatever APP_URL happened to resolve to then (never set during the
// Dockerfile's build stage — only at container run time via
// docker-compose.yml) — freezing it to the localhost fallback forever,
// immune to the real APP_URL. Forcing dynamic rendering makes this
// evaluate per-request in the actual running container instead. Same fix
// as sitemap.xml/route.ts.
export const dynamic = "force-dynamic";

const baseUrl = process.env.APP_URL || "http://localhost:3000";

// Only the landing page is public. Room pages (/r/<slug> and its /results)
// carry other participants' names and availability — crawlable would mean
// indexable/cacheable, which nothing about a room's trust model (see
// AGENTS.md: identity is a cookie + display name, no auth) is designed for.
// /status is the token-gated admin page (see HANDOVER "Status page") —
// excluded so its query-string token never ends up in a crawler's logs or
// Search Console, even though it 404s without a valid key regardless.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/r", "/status"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
