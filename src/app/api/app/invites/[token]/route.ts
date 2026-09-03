import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { ROLE_NAMES } from "@/lib/rbac/roles";
import { assertInviteAcceptable, isInviteExpired, publicInviteView } from "@/lib/invites";
import { adminSdkMissingResponse, getAdminApp, getAdminFirestore } from "@/lib/server/firebaseAdmin";
import type { TenantInvite, TenantUser } from "@/types";

export const dynamic = "force-dynamic";

function bearer(req: NextRequest): string | null {
  return req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || null;
}

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const db = getAdminFirestore();
  if (!db) return adminSdkMissingResponse();
  const token = params.token?.trim();
  if (!token) return NextResponse.json({ error: "Convite inválido." }, { status: 400 });

  try {
    const snap = await db.collection("invites").doc(token).get();
    if (!snap.exists) return NextResponse.json({ error: "Convite não encontrado." }, { status: 404 });
    const invite = { id: snap.id, ...snap.data() } as TenantInvite;
    return NextResponse.json(publicInviteView(invite));
  } catch {
    return NextResponse.json({ error: "Erro ao carregar o convite." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const db = getAdminFirestore();
  if (!db) return adminSdkMissingResponse();
  const token = params.token?.trim();
  if (!token) return NextResponse.json({ error: "Convite inválido." }, { status: 400 });

  const idToken = bearer(req);
  if (!idToken) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  try {
    const decoded = await getAuth(getAdminApp()!).verifyIdToken(idToken);
    const email = String(decoded.email ?? "");
    if (!email) return NextResponse.json({ error: "Conta sem e-mail." }, { status: 400 });

    const inviteRef = db.collection("invites").doc(token);
    const inviteSnap = await inviteRef.get();
    const invite = inviteSnap.exists ? ({ id: inviteSnap.id, ...inviteSnap.data() } as TenantInvite) : null;

    if (!invite) return NextResponse.json({ error: "Convite não encontrado." }, { status: 404 });
    if (isInviteExpired(invite)) {
      await inviteRef.update({ status: "expired" });
      return NextResponse.json({ error: "Este convite expirou. Peça um novo convite à empresa." }, { status: 410 });
    }

    const membersSnap = await db.collection("tenant_users").where("userId", "==", decoded.uid).get();
    const memberships = membersSnap.docs.map((d) => d.data() as TenantUser);
    const accepted = assertInviteAcceptable({ invite, actorEmail: email, memberships });

    const memberRef = db.collection("tenant_users").doc(`${decoded.uid}_${accepted.tenantId}`);
    await db.runTransaction(async (tx) => {
      const latest = await tx.get(inviteRef);
      if (!latest.exists) throw new Error("Convite não encontrado.");
      const current = latest.data() as TenantInvite;
      if (current.status !== "pending") throw new Error("Este convite não está mais pendente.");
      tx.set(memberRef, {
        userId: decoded.uid,
        tenantId: accepted.tenantId,
        role: accepted.role,
        status: "active",
        email,
        displayName: decoded.name ?? email,
        invitedBy: current.invitedBy,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.update(inviteRef, {
        status: "accepted",
        acceptedAt: FieldValue.serverTimestamp(),
        acceptedBy: decoded.uid,
      });
      tx.set(
        db.collection("users").doc(decoded.uid),
        { activeTenantId: accepted.tenantId },
        { merge: true }
      );
    });

    return NextResponse.json({
      ok: true,
      tenantId: accepted.tenantId,
      role: accepted.role,
      roleLabel: ROLE_NAMES[accepted.role],
    });
  } catch (err) {
    const message = (err as Error).message || "Erro ao aceitar o convite.";
    const status = message.includes("Não autenticado") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
