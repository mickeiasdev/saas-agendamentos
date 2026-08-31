import { NextRequest } from "next/server";
import { getAdminFirestore } from "@/lib/server/firebaseAdmin";
import { getMockSlots } from "@/lib/server/mockTenant";
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
    return Response.json(getMockSlots({ serviceId, professionalId, date }));
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
