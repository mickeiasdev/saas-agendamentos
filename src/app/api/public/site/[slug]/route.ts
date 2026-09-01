import { NextRequest } from "next/server";
import { adminSdkMissingResponse, getAdminFirestore } from "@/lib/server/firebaseAdmin";
import type { Professional, ProfessionalAvailability, Service, Tenant } from "@/types";

const DAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

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

export interface ScheduleEntry {
  dayOfWeek: number;
  label: string;
  open: string;
  close: string;
}

/**
 * Calcula o expediente agregado da empresa (unindo a disponibilidade de todos
 * os profissionais ativos): para cada dia da semana, o primeiro horário de
 * abertura e o último de fechamento observados.
 */
function buildSchedule(availabilities: ProfessionalAvailability[]): ScheduleEntry[] {
  const byDay = new Map<number, { min: number; max: number }>();
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const toTime = (min: number) =>
    `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

  for (const av of availabilities) {
    for (const wd of av.workDays) {
      if (!wd.enabled) continue;
      const cur = byDay.get(wd.dayOfWeek) ?? { min: 1440, max: 0 };
      cur.min = Math.min(cur.min, toMin(wd.startTime));
      cur.max = Math.max(cur.max, toMin(wd.endTime));
      byDay.set(wd.dayOfWeek, cur);
    }
  }

  return [0, 1, 2, 3, 4, 5, 6]
    .filter((d) => byDay.has(d))
    .map((d) => {
      const { min, max } = byDay.get(d)!;
      return { dayOfWeek: d, label: DAY_LABELS[d], open: toTime(min), close: toTime(max) };
    });
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
    return adminSdkMissingResponse();
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

    const activeProIds = professionals.map((p) => p.id);
    const avSnap = await db
      .collection("tenants")
      .doc(doc.id)
      .collection("availability")
      .get();
    const availabilities = avSnap.docs
      .map((d) => d.data() as ProfessionalAvailability)
      .filter((a) => activeProIds.includes(a.professionalId));
    const schedule = buildSchedule(availabilities);

    return Response.json({ tenant: publicTenant, services, professionals, schedule });
  } catch (err) {
    return Response.json({ error: "Erro interno ao carregar o site." }, { status: 500 });
  }
}
