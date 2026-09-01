import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/server/firebaseAdmin";
import { authorizeApiRequest } from "@/lib/server/apiKeys";
import {
  ApiValidationError,
  apiCreateAppointment,
  apiListAppointments,
  BookingError,
} from "@/lib/server/publicApi";

export const dynamic = "force-dynamic";

/**
 * /api/v1/appointments (Fase 3.12 + 3.13)
 * GET  — lista agendamentos (escopo appointments:read)
 * POST — cria agendamento (escopo appointments:write)
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

  const auth = await authorizeApiRequest(db, req, "appointments:read");
  if (auth.error) return auth.error;

  const sp = req.nextUrl.searchParams;
  try {
    const data = await apiListAppointments(db, auth.context.tenantId, {
      limit: Number(sp.get("limit")) || undefined,
      status: sp.get("status") ?? undefined,
      from: sp.get("from") ?? undefined,
      to: sp.get("to") ?? undefined,
    });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Erro interno ao listar agendamentos." }, { status: 500 });
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

  const auth = await authorizeApiRequest(db, req, "appointments:write");
  if (auth.error) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  try {
    const result = await apiCreateAppointment(db, auth.context.tenantId, body as never);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ApiValidationError || err instanceof BookingError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno ao criar agendamento." }, { status: 500 });
  }
}
