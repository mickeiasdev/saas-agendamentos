import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/server/firebaseAdmin";
import { requirePlatformRole } from "@/lib/server/guard";
import type { Tenant } from "@/types";

export const dynamic = "force-dynamic";

export interface MasterTenantRow {
  id: string;
  slug: string;
  name: string;
  tradeName?: string;
  segmentId?: string;
  planId: string;
  status: string;
  ownerUserId: string;
  userCount: number;
  appointmentCount: number;
  createdAt?: unknown;
}

/**
 * GET /api/master/tenants
 * Lista empresas, usuários e agendamentos da plataforma (Painel Master).
 * Requer papel PLATFORM_ADMIN ou PLATFORM_OWNER.
 */
export async function GET(req: NextRequest) {
  const guard = await requirePlatformRole(req, "PLATFORM_ADMIN");
  if (guard.error) return guard.error;
  const db = getAdminFirestore()!;

  try {
    const tenantsSnap = await db.collection("tenants").orderBy("createdAt", "desc").limit(200).get();

    const rows: MasterTenantRow[] = [];
    let appointmentTotal = 0;

    for (const doc of tenantsSnap.docs) {
      const data = doc.data() as Tenant;
      const [usersSnap, appsSnap] = await Promise.all([
        db.collection("tenant_users").where("tenantId", "==", doc.id).count().get(),
        db.collection("tenants").doc(doc.id).collection("appointments").count().get(),
      ]);
      const userCount = usersSnap.data().count;
      const appointmentCount = appsSnap.data().count;
      appointmentTotal += appointmentCount;

      rows.push({
        id: doc.id,
        slug: data.slug,
        name: data.name,
        tradeName: data.tradeName,
        segmentId: data.segmentId,
        planId: data.planId,
        status: data.status,
        ownerUserId: data.ownerUserId,
        userCount,
        appointmentCount,
        createdAt: data.createdAt,
      });
    }

    const [tenantsTotal, usersTotal] = await Promise.all([
      db.collection("tenants").count().get(),
      db.collection("users").count().get(),
    ]);

    return NextResponse.json({
      stats: {
        tenants: tenantsTotal.data().count,
        users: usersTotal.data().count,
        appointments: appointmentTotal,
      },
      tenants: rows,
    });
  } catch {
    return NextResponse.json({ error: "Erro interno ao carregar a plataforma." }, { status: 500 });
  }
}
