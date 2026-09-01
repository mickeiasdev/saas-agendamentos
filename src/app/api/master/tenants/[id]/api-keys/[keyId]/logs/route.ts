import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/server/firebaseAdmin";
import { requirePlatformRole } from "@/lib/server/guard";
import { listApiKeyLogs } from "@/lib/server/apiKeys";

export const dynamic = "force-dynamic";

/**
 * GET /api/master/tenants/[id]/api-keys/[keyId]/logs (Fase 3.13)
 * Logs de uso de uma API key (método, caminho, status, IP, horário).
 * Requer papel PLATFORM_ADMIN ou PLATFORM_OWNER.
 */
export async function GET(
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

  const sp = req.nextUrl.searchParams;
  try {
    const logs = await listApiKeyLogs(db, tenantId, {
      apiKeyId: keyId,
      limit: Number(sp.get("limit")) || undefined,
    });
    return NextResponse.json({ tenantId, apiKeyId: keyId, items: logs });
  } catch {
    return NextResponse.json({ error: "Erro interno ao carregar os logs." }, { status: 500 });
  }
}
