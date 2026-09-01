import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/server/firebaseAdmin";
import { requirePlatformRole } from "@/lib/server/guard";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/master/tenants/[id]/users/[userId]
 * Ativa ou desabilita um usuário dentro da empresa.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; userId: string } }
) {
  const guard = await requirePlatformRole(req, "PLATFORM_ADMIN");
  if (guard.error) return guard.error;
  const db = getAdminFirestore()!;

  const tenantId = params.id?.trim();
  const userId = params.userId?.trim();
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "Parâmetro inválido." }, { status: 400 });
  }

  let body: { status?: string };
  try {
    body = (await req.json()) as { status?: string };
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  if (!["active", "disabled"].includes(body.status ?? "")) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }

  try {
    const ref = db.collection("tenant_users").doc(`${userId}_${tenantId}`);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Usuário não pertence a esta empresa." }, { status: 404 });
    }
    await ref.update({ status: body.status, updatedAt: FieldValue.serverTimestamp() });

    await db.collection("platform_audit").add({
      tenantId,
      userId: guard.auth!.uid,
      action: body.status === "disabled" ? "master.user.disable" : "master.user.enable",
      entityType: "tenant_user",
      entityId: `${userId}_${tenantId}`,
      createdAt: FieldValue.serverTimestamp(),
    });

    await db
      .collection("tenants")
      .doc(tenantId)
      .collection("audit")
      .add({
        tenantId,
        userId: guard.auth!.uid,
        action: body.status === "disabled" ? "master.user.disable" : "master.user.enable",
        entityType: "tenant_user",
        entityId: `${userId}_${tenantId}`,
        createdAt: FieldValue.serverTimestamp(),
      });

    return NextResponse.json({ ok: true, id: ref.id, status: body.status });
  } catch {
    return NextResponse.json({ error: "Erro interno ao atualizar o usuário." }, { status: 500 });
  }
}
