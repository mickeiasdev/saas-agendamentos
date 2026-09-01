import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/server/firebaseAdmin";
import { requirePlatformRole } from "@/lib/server/guard";

export const dynamic = "force-dynamic";

export interface PlatformUserRow {
  uid: string;
  email?: string;
  displayName?: string;
  platformRole?: string;
  createdAt?: unknown;
  memberships: Array<{ tenantId: string; role: string; status: string }>;
}

/**
 * GET /api/master/users
 * Lista usuários da plataforma (não só no modal por empresa).
 */
export async function GET(req: NextRequest) {
  const guard = await requirePlatformRole(req, "PLATFORM_ADMIN");
  if (guard.error) return guard.error;
  const db = getAdminFirestore()!;

  try {
    const usersSnap = await db.collection("users").limit(200).get();
    const membersSnap = await db.collection("tenant_users").limit(1000).get();

    const membershipsByUser = new Map<string, Array<{ tenantId: string; role: string; status: string }>>();
    for (const d of membersSnap.docs) {
      const data = d.data();
      const userId = String(data.userId ?? "");
      if (!userId) continue;
      const list = membershipsByUser.get(userId) ?? [];
      list.push({
        tenantId: String(data.tenantId ?? ""),
        role: String(data.role ?? ""),
        status: String(data.status ?? "active"),
      });
      membershipsByUser.set(userId, list);
    }

    const users: PlatformUserRow[] = usersSnap.docs.map((d) => {
      const data = d.data();
      return {
        uid: d.id,
        email: data.email ? String(data.email) : undefined,
        displayName: data.displayName ? String(data.displayName) : undefined,
        platformRole: data.platformRole ? String(data.platformRole) : "USER",
        createdAt: data.createdAt ?? null,
        memberships: membershipsByUser.get(d.id) ?? [],
      };
    });

    return NextResponse.json({ users });
  } catch {
    return NextResponse.json({ error: "Erro interno ao carregar os usuários." }, { status: 500 });
  }
}
