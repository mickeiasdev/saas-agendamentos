import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/server/firebaseAdmin";
import { requirePlatformRole } from "@/lib/server/guard";

export const dynamic = "force-dynamic";

const ACTIONS = ["suspend", "activate", "pending"] as const;
type TenantAction = (typeof ACTIONS)[number];

/**
 * PATCH /api/master/tenants/[id]
 * Suspende, reativa ou define como pendente uma empresa.
 * Requer papel PLATFORM_ADMIN ou PLATFORM_OWNER.
 */
export async function PATCH(
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

  let body: { action?: string };
  try {
    body = (await req.json()) as { action?: string };
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const action = body.action as TenantAction | undefined;
  if (!action || !ACTIONS.includes(action)) {
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  }

  try {
    const ref = db.collection("tenants").doc(tenantId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
    }

    const status = action === "suspend" ? "suspended" : action === "pending" ? "pending" : "active";
    await ref.update({ status, updatedAt: FieldValue.serverTimestamp() });

    await db
      .collection("tenants")
      .doc(tenantId)
      .collection("audit")
      .add({
        tenantId,
        userId: guard.auth!.uid,
        action: `master.tenant.${action}`,
        entityType: "tenant",
        entityId: tenantId,
        metadata: { from: snap.data()?.status, to: status },
        createdAt: FieldValue.serverTimestamp(),
      });

    return NextResponse.json({ ok: true, id: tenantId, status });
  } catch {
    return NextResponse.json({ error: "Erro interno ao atualizar a empresa." }, { status: 500 });
  }
}
