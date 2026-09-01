import type { Metadata } from "next";
import { headers } from "next/headers";
import { getAdminFirestore } from "@/lib/server/firebaseAdmin";
import type { Tenant } from "@/types";

export const dynamic = "force-dynamic";

async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  const db = getAdminFirestore();
  if (!db) return null;
  try {
    const snap = await db.collection("tenants").where("slug", "==", slug).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { ...(doc.data() as Tenant), id: doc.id };
  } catch {
    return null;
  }
}

function getSiteBase(): string {
  const h = headers();
  const host = h.get("host") ?? "agendasaas.app";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export async function generateMetadata({
  params,
}: {
  params: { tenant: string };
}): Promise<Metadata> {
  const slug = (params.tenant ?? "").trim().toLowerCase();
  const base = getSiteBase();
  const url = `${base}/${slug}`;

  const tenant = await getTenantBySlug(slug);
  if (!tenant) {
    return {
      title: "Empresa não encontrada",
      robots: { index: false, follow: false },
    };
  }

  const name = tenant.tradeName || tenant.name;
  const description =
    tenant.description?.trim().slice(0, 160) ||
    `Agende seu horário na ${name} online, sem precisar ligar.`;
  const image = tenant.logoUrl || tenant.bannerUrl || tenant.branding?.bannerUrl;
  const images = image ? [{ url: image, width: 1200, height: 630, alt: name }] : undefined;

  return {
    title: name,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName: "Agenda SaaS",
      title: name,
      description,
      url,
      images,
    },
    robots: { index: true, follow: true },
  };
}

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
