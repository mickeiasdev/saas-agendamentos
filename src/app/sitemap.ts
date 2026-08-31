import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getAdminFirestore } from "@/lib/server/firebaseAdmin";

export const dynamic = "force-dynamic";

function getSiteBase(): string {
  const h = headers();
  const host = h.get("host") ?? "agendasaas.app";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteBase();
  const entries: MetadataRoute.Sitemap = [
    {
      url: base,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];

  const db = getAdminFirestore();
  if (db) {
    try {
      const snap = await db.collection("tenants").where("status", "in", ["active", "trial"]).get();
      for (const doc of snap.docs) {
        const slug = doc.data().slug;
        if (typeof slug === "string" && slug) {
          entries.push({
            url: `${base}/${slug}`,
            changeFrequency: "weekly",
            priority: 0.9,
          });
        }
      }
    } catch {
      // Sem acesso ao banco: publica apenas as rotas estáticas.
    }
  }

  return entries;
}
