import { NextRequest } from "next/server";
import { adminSdkMissingResponse, getAdminFirestore } from "@/lib/server/firebaseAdmin";
import { listPublicSlots, BookingError } from "@/lib/booking/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = getAdminFirestore();
  const sp = req.nextUrl.searchParams;
  const tenantSlug = sp.get("tenant");
  const serviceId = sp.get("serviceId");
  const professionalId = sp.get("professionalId");
  const date = sp.get("date");

  if (!tenantSlug || !serviceId || !professionalId || !date) {
    return Response.json({ error: "Parâmetros inválidos." }, { status: 400 });
  }

  if (!db) {
    return adminSdkMissingResponse();
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
