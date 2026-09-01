import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/server/firebaseAdmin";
import { authorizeApiRequest } from "@/lib/server/apiKeys";
import { ApiValidationError, apiCreateCustomer, apiListCustomers } from "@/lib/server/publicApi";

export const dynamic = "force-dynamic";

/**
 * /api/v1/customers (Fase 3.12 + 3.13)
 * GET  — lista clientes (escopo customers:read)
 * POST — cria cliente (escopo customers:write)
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

  const auth = await authorizeApiRequest(db, req, "customers:read");
  if (auth.error) return auth.error;

  const sp = req.nextUrl.searchParams;
  try {
    const data = await apiListCustomers(db, auth.context.tenantId, {
      limit: Number(sp.get("limit")) || undefined,
      cursor: sp.get("cursor") ?? undefined,
      search: sp.get("search") ?? undefined,
    });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Erro interno ao listar clientes." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const db = getAdminFirestore();
  if (!db) {
    return NextResponse.json(
      { error: "API pública requer Admin SDK configurado (FIREBASE_SERVICE_ACCOUNT_JSON)." },
      { status: 503 }
    );
  }

  const auth = await authorizeApiRequest(db, req, "customers:write");
  if (auth.error) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  try {
    const result = await apiCreateCustomer(db, auth.context.tenantId, body as never);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ApiValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno ao criar cliente." }, { status: 500 });
  }
}
