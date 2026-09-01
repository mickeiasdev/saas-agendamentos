import { NextRequest } from "next/server";
import { adminSdkMissingResponse, getAdminFirestore } from "@/lib/server/firebaseAdmin";
import { BookingError, reschedulePublicAppointment } from "@/lib/booking/server";

export const dynamic = "force-dynamic";

interface RescheduleBody {
  tenantSlug?: string;
  appointmentId?: string;
  date?: string;
  time?: string;
  professionalId?: string;
  serviceId?: string;
}

/**
 * POST /api/public/reschedule
 * Remarcação pública pelo site da empresa. Isolamento pelo slug: um
 * agendamento do Tenant A nunca é localizável pelo slug do Tenant B.
 */
export async function POST(req: NextRequest) {
  const db = getAdminFirestore();

  let body: RescheduleBody;
  try {
    body = (await req.json()) as RescheduleBody;
  } catch {
    return Response.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const tenantSlug = body.tenantSlug?.trim().toLowerCase();
  const appointmentId = body.appointmentId?.trim();
  const date = body.date?.trim();
  const time = body.time?.trim();
  if (!tenantSlug || !appointmentId || !date || !time) {
    return Response.json({ error: "Dados incompletos para a remarcação." }, { status: 400 });
  }

  if (!db) {
    return adminSdkMissingResponse();
  }

  try {
    const result = await reschedulePublicAppointment(db, {
      tenantSlug,
      appointmentId,
      date,
      time,
      professionalId: body.professionalId?.trim() || undefined,
      serviceId: body.serviceId?.trim() || undefined,
    });
    return Response.json(result);
  } catch (err) {
    const message = err instanceof BookingError ? err.message : "Erro interno ao remarcar o agendamento.";
    return Response.json(
      { error: message },
      { status: err instanceof BookingError ? 400 : 500 }
    );
  }
}
