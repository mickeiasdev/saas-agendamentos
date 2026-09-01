import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/server/firebaseAdmin";
import { requirePlatformRole } from "@/lib/server/guard";
import { getApiKey, revokeApiKey } from "@/lib/server/apiKeys";

export const dynamic = "force-dynamic";

/**
 * POST /api/master/tenants/[id]/api-keys/[keyId]/revoke (Fase 3.13)
 * Revoga imediatamente uma API key.
 * Requer papel PLATFORM_ADMIN ou PLATFORM_OWNER.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; keyId: string } }
) {
  const guard = await requirePlatformRole(req, "PLATFORM_ADMIN");
  if (guard.error) return guard.error;
  const db = getAdminFirestore()!;

  const tenantId = params.id?.trim();
  const keyId = params.keyId?.trim();
  if (!tenantId || !keyId) {
    return NextResponse.json({ error: "Parâmetro inválido." }, { status: 400 });
  }

  try {
    const key = await getApiKey(db, tenantId, keyId);
    if (!key) {
      return NextResponse.json({ error: "API key não encontrada." }, { status: 404 });
    }
    await revokeApiKey(db, tenantId, keyId);

    await db
      .collection("tenants")
      .doc(tenantId)
      .collection("audit")
      .add({
        tenantId,
        userId: guard.auth!.uid,
        action: "master.apikey.revoke",
        entityType: "api_key",
        entityId: keyId,
        metadata: { name: key.name },
        createdAt: FieldValue.serverTimestamp(),
      });

    return NextResponse.json({ ok: true, id: keyId, revoked: true });
  } catch {
    return NextResponse.json({ error: "Erro interno ao revogar a API key." }, { status: 500 });
  }
}
