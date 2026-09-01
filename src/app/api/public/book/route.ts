import { NextRequest } from "next/server";
import { adminSdkMissingResponse, getAdminFirestore } from "@/lib/server/firebaseAdmin";
import { createPublicAppointment, BookingError, type PublicBookingInput } from "@/lib/booking/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const db = getAdminFirestore();

  let body: PublicBookingInput;
  try {
    body = (await req.json()) as PublicBookingInput;
  } catch {
    return Response.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const customerName = body?.customer?.name?.trim();
  if (
    !body ||
    !body.tenantSlug ||
    !body.serviceId ||
    !body.professionalId ||
    !body.date ||
    !body.time ||
    !customerName
  ) {
    return Response.json({ error: "Dados incompletos para o agendamento." }, { status: 400 });
  }

  const cleaned: PublicBookingInput = {
    ...body,
    customer: {
      name: customerName,
      phone: body.customer.phone?.trim() || undefined,
      email: body.customer.email?.trim() || undefined,
    },
    notes: body.notes?.trim() || undefined,
    couponCode: body.couponCode?.trim().toUpperCase() || undefined,
  };

  if (!db) {
    return adminSdkMissingResponse();
  }

  try {
    const result = await createPublicAppointment(db, cleaned);
    return Response.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof BookingError ? err.message : "Erro interno ao confirmar o agendamento.";
    return Response.json(
      { error: message },
      { status: err instanceof BookingError ? 400 : 500 }
    );
  }
}
