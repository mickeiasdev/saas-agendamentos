import { NextRequest } from "next/server";
import { getAdminFirestore } from "@/lib/server/firebaseAdmin";
import type { Professional, Service, Tenant } from "@/types";

export const dynamic = "force-dynamic";

interface PublicTenant {
  id: string;
  slug: string;
  name: string;
  tradeName?: string;
  description?: string;
  segmentId?: string;
  status: string;
  branding: Tenant["branding"];
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: Tenant["address"];
  instagram?: string;
}

/**
 * Endpoint público de dados do site da empresa.
 *
 * NUNCA expõe dados sensíveis do tenant (cnpjCpf, ownerUserId, planId,
 * subscriptionStatus, settings, featureFlags, limits). Esses campos ficam no
 * documento do tenant para uso autenticado (painel) e no Admin SDK, mas o site
 * público recebe apenas uma projeção sanitizada.
 */
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const db = getAdminFirestore();
  if (!db) {
    return Response.json(
      { error: "Backend ainda não configurado. Configure a service account do Firebase no ambiente." },
      { status: 503 }
    );
  }

  const slug = (params.slug ?? "").trim().toLowerCase();
  if (!slug) {
    return Response.json({ error: "Parâmetro inválido." }, { status: 400 });
  }

  try {
    const tenantSnap = await db.collection("tenants").where("slug", "==", slug).limit(1).get();
    if (tenantSnap.empty) {
      return Response.json({ error: "Empresa não encontrada." }, { status: 404 });
    }
    const doc = tenantSnap.docs[0];
    const raw = doc.data() as Tenant;

    const publicTenant: PublicTenant = {
      id: doc.id,
      slug: raw.slug,
      name: raw.name,
      tradeName: raw.tradeName,
      description: raw.description,
      segmentId: raw.segmentId,
      status: raw.status,
      branding: raw.branding,
      phone: raw.phone,
      whatsapp: raw.whatsapp,
      email: raw.email,
      address: raw.address,
      instagram: raw.instagram,
    };

    const svcSnap = await db
      .collection("tenants")
      .doc(doc.id)
      .collection("services")
      .where("status", "==", "active")
      .get();
    const services = svcSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Service);

    const proSnap = await db
      .collection("tenants")
      .doc(doc.id)
      .collection("professionals")
      .where("active", "==", true)
      .get();
    const professionals = proSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Professional);

    return Response.json({ tenant: publicTenant, services, professionals });
  } catch (err) {
    return Response.json({ error: "Erro interno ao carregar o site." }, { status: 500 });
  }
}
