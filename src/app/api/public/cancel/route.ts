import { NextRequest } from "next/server";
import { getAdminFirestore } from "@/lib/server/firebaseAdmin";
import { BookingError, cancelPublicAppointment } from "@/lib/booking/server";

export const dynamic = "force-dynamic";

interface CancelBody {
  tenantSlug?: string;
  appointmentId?: string;
  reason?: string;
}

/**
 * POST /api/public/cancel
 * Cancelamento público de agendamento pelo site da empresa.
 * A busca do documento é feita dentro da subcoleção do tenant correspondente
 * ao slug, garantindo isolamento multi-tenant no backend.
 */
export async function POST(req: NextRequest) {
  const db = getAdminFirestore();

  let body: CancelBody;
  try {
    body = (await req.json()) as CancelBody;
  } catch {
    return Response.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const tenantSlug = body.tenantSlug?.trim().toLowerCase();
  const appointmentId = body.appointmentId?.trim();
  if (!tenantSlug || !appointmentId) {
    return Response.json({ error: "Dados incompletos para o cancelamento." }, { status: 400 });
  }

  if (!db) {
    return Response.json({ ok: true });
  }

  try {
    const result = await cancelPublicAppointment(db, { tenantSlug, appointmentId, reason: body.reason });
    return Response.json(result);
  } catch (err) {
    const message = err instanceof BookingError ? err.message : "Erro interno ao cancelar o agendamento.";
    return Response.json(
      { error: message },
      { status: err instanceof BookingError ? 400 : 500 }
    );
  }
}
