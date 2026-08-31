import type { MetadataRoute } from "next";
import { headers } from "next/headers";

function getSiteBase(): string {
  const h = headers();
  const host = h.get("host") ?? "agendasaas.app";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export default function robots(): MetadataRoute.Robots {
  const base = getSiteBase();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app", "/login", "/signup", "/recover", "/api"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
