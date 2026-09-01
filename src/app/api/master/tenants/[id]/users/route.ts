import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/server/firebaseAdmin";
import { requirePlatformRole } from "@/lib/server/guard";

export const dynamic = "force-dynamic";

export interface MasterUserRow {
  id: string;
  userId: string;
  role: string;
  status: string;
  displayName?: string;
  email?: string;
}

/**
 * GET /api/master/tenants/[id]/users
 * Lista os usuários de uma empresa (Painel Master). As Firestore Rules não
 * permitem ler tenant_users de terceiros pelo cliente, então isto roda no
 * Admin SDK.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requirePlatformRole(req, "PLATFORM_ADMIN");
  if (guard.error) return guard.error;
  const db = getAdminFirestore()!;

  const tenantId = params.id?.trim();
  if (!tenantId) {
    return NextResponse.json({ error: "Parâmetro inválido." }, { status: 400 });
  }

  try {
    const membersSnap = await db
      .collection("tenant_users")
      .where("tenantId", "==", tenantId)
      .get();

    const users: MasterUserRow[] = [];
    for (const d of membersSnap.docs) {
      const data = d.data();
      const profileSnap = await db.collection("users").doc(String(data.userId)).get();
      const email = profileSnap.exists ? String(profileSnap.data()?.email ?? "") : undefined;
      users.push({
        id: d.id,
        userId: String(data.userId),
        role: String(data.role ?? ""),
        status: String(data.status ?? "active"),
        displayName: data.displayName ? String(data.displayName) : undefined,
        email: email || undefined,
      });
    }

    return NextResponse.json({ tenantId, users });
  } catch {
    return NextResponse.json({ error: "Erro interno ao carregar os usuários." }, { status: 500 });
  }
}


