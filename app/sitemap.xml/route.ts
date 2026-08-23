import { NextResponse } from "next/server";

// Without this, Next prerenders this route at Docker *build* time (it has
// no dynamic APIs, so it looks static) and bakes in whatever APP_URL
// happened to be during `npm run build` — never set during the Dockerfile's
// build stage, only at container run time. That freezes the sitemap to the
// http://localhost:3000 fallback forever, immune to the real APP_URL.
// Forcing dynamic rendering makes this evaluate per-request in the actual
// running container instead.
export const dynamic = "force-dynamic";

const baseUrl = process.env.APP_URL || "http://localhost:3000";

// A custom route handler rather than the framework's sitemap.ts convention:
// Next hardcodes that convention's response to `Content-Type: application/xml`
// with no charset (next-metadata-route-loader.js), which Google Search
// Console has been reported to choke on ("couldn't fetch"/"couldn't read")
// even though the XML itself is valid — same fix listing-studio uses.
// Serving it here with an explicit `text/xml; charset=UTF-8` sidesteps that.
function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (char) => {
    switch (char) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      default:
        return "&quot;";
    }
  });
}

// Only the landing page — see robots.ts for why every /r/<slug> room page
// is excluded (private, and rooms expire within days anyway per
// lib/expiry.ts, so they'd be dead links in a crawler's index almost
// immediately regardless).
export function GET(): NextResponse {
  const lastmod = new Date().toISOString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${escapeXml(baseUrl)}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1</priority>
  </url>
</urlset>
`;

  return new NextResponse(xml, {
    headers: { "Content-Type": "text/xml; charset=UTF-8" },
  });
}
