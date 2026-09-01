import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/server/firebaseAdmin";
import { authorizeApiRequest } from "@/lib/server/apiKeys";
import { apiListProfessionals } from "@/lib/server/publicApi";

export const dynamic = "force-dynamic";

/**
 * /api/v1/professionals (Fase 3.12 + 3.13)
 * GET — lista profissionais ativos (escopo professionals:read)
 * Autenticação: Authorization: Bearer <api_key>
 */
export async function GET(req: NextRequest) {
  const db = getAdminFirestore();
  if (!db) {
    return NextResponse.json(
      { error: "API pública requer Admin SDK configurado (FIREBASE_SERVICE_ACCOUNT_JSON)." },
      { status: 503 }
    );
  }

  const auth = await authorizeApiRequest(db, req, "professionals:read");
  if (auth.error) return auth.error;

  try {
    const professionals = await apiListProfessionals(db, auth.context.tenantId);
    return NextResponse.json({ items: professionals });
  } catch {
    return NextResponse.json({ error: "Erro interno ao listar profissionais." }, { status: 500 });
  }
}
