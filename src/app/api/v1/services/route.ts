import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/server/firebaseAdmin";
import { authorizeApiRequest } from "@/lib/server/apiKeys";
import { apiListServices } from "@/lib/server/publicApi";

export const dynamic = "force-dynamic";

/**
 * /api/v1/services (Fase 3.12 + 3.13)
 * GET — lista serviços ativos (escopo services:read)
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

  const auth = await authorizeApiRequest(db, req, "services:read");
  if (auth.error) return auth.error;

  try {
    const services = await apiListServices(db, auth.context.tenantId);
    return NextResponse.json({ items: services });
  } catch {
    return NextResponse.json({ error: "Erro interno ao listar serviços." }, { status: 500 });
  }
}
