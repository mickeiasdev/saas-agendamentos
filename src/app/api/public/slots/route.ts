import { NextRequest } from "next/server";
import { getAdminFirestore } from "@/lib/server/firebaseAdmin";
import { listPublicSlots, BookingError } from "@/lib/booking/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = getAdminFirestore();
  if (!db) {
    return Response.json(
      { error: "Backend ainda não configurado. Configure a service account do Firebase no ambiente." },
      { status: 503 }
    );
  }

  const sp = req.nextUrl.searchParams;
  const tenantSlug = sp.get("tenant");
  const serviceId = sp.get("serviceId");
  const professionalId = sp.get("professionalId");
  const date = sp.get("date");

  if (!tenantSlug || !serviceId || !professionalId || !date) {
    return Response.json({ error: "Parâmetros inválidos." }, { status: 400 });
  }

  try {
    const result = await listPublicSlots(db, { tenantSlug, serviceId, professionalId, date });
    return Response.json(result);
  } catch (err) {
    const message = err instanceof BookingError ? err.message : "Erro interno ao consultar horários.";
    return Response.json(
      { error: message },
      { status: err instanceof BookingError ? 400 : 500 }
    );
  }
}
