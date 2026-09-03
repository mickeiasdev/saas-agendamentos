import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminSdkMissingResponse, getAdminFirestore } from "@/lib/server/firebaseAdmin";
import { requireTenantMember } from "@/lib/server/guard";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; token: string } }
) {
  const tenantId = params.id?.trim();
  const token = params.token?.trim();
  const guard = await requireTenantMember(req, tenantId, "team.manage");
  if (guard.error) return guard.error;
  const db = getAdminFirestore();
  if (!db) return adminSdkMissingResponse();
  if (!token) return NextResponse.json({ error: "Convite inválido." }, { status: 400 });

  try {
    const ref = db.collection("invites").doc(token);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Convite não encontrado." }, { status: 404 });
    const data = snap.data() ?? {};
    if (data.tenantId !== tenantId) {
      return NextResponse.json({ error: "Convite não pertence a esta empresa." }, { status: 403 });
    }
    await ref.update({ status: "revoked", updatedAt: FieldValue.serverTimestamp() });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erro ao revogar o convite." }, { status: 500 });
  }
}
