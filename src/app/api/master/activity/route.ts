import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/server/firebaseAdmin";
import { requirePlatformRole } from "@/lib/server/guard";

export const dynamic = "force-dynamic";

export interface MasterActivityRow {
  id: string;
  tenantId?: string;
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  createdAt?: unknown;
}

/**
 * GET /api/master/activity
 * Feed de atividade da plataforma (auditoria).
 */
export async function GET(req: NextRequest) {
  const guard = await requirePlatformRole(req, "PLATFORM_ADMIN");
  if (guard.error) return guard.error;
  const db = getAdminFirestore()!;

  try {
    const snap = await db.collection("platform_audit").orderBy("createdAt", "desc").limit(50).get();
    let items: MasterActivityRow[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        tenantId: data.tenantId ? String(data.tenantId) : undefined,
        userId: data.userId ? String(data.userId) : undefined,
        action: String(data.action ?? ""),
        entityType: data.entityType ? String(data.entityType) : undefined,
        entityId: data.entityId ? String(data.entityId) : undefined,
        createdAt: data.createdAt ?? null,
      };
    });

    if (items.length === 0) {
      const tenantsSnap = await db.collection("tenants").limit(20).get();
      const collected: MasterActivityRow[] = [];
      for (const t of tenantsSnap.docs) {
        const auditSnap = await db
          .collection("tenants")
          .doc(t.id)
          .collection("audit")
          .orderBy("createdAt", "desc")
          .limit(10)
          .get();
        for (const d of auditSnap.docs) {
          const data = d.data();
          collected.push({
            id: d.id,
            tenantId: t.id,
            userId: data.userId ? String(data.userId) : undefined,
            action: String(data.action ?? ""),
            entityType: data.entityType ? String(data.entityType) : undefined,
            entityId: data.entityId ? String(data.entityId) : undefined,
            createdAt: data.createdAt ?? null,
          });
        }
      }
      items = collected
        .sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))
        .slice(0, 50);
    }

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: "Erro interno ao carregar a atividade." }, { status: 500 });
  }
}

function toMs(v: unknown): number {
  if (!v) return 0;
  if (typeof v === "object" && v !== null && typeof (v as { toMillis?: unknown }).toMillis === "function") {
    return (v as { toMillis: () => number }).toMillis();
  }
  if (v instanceof Date) return v.getTime();
  const n = new Date(String(v)).getTime();
  return Number.isNaN(n) ? 0 : n;
}
