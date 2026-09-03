import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { ROLE_NAMES } from "@/lib/rbac/roles";
import {
  assertCanCreateInvite,
  inviteExpiresAt,
  isInviteExpired,
  normalizeInviteEmail,
} from "@/lib/invites";
import { adminSdkMissingResponse, getAdminFirestore } from "@/lib/server/firebaseAdmin";
import { requireTenantMember } from "@/lib/server/guard";
import type { TenantInvite, TenantUser } from "@/types";

export const dynamic = "force-dynamic";

function asInvite(id: string, data: Record<string, unknown>): TenantInvite {
  return { id, ...(data as Omit<TenantInvite, "id">) };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const tenantId = params.id?.trim();
  const guard = await requireTenantMember(req, tenantId, "team.manage");
  if (guard.error) return guard.error;
  const db = getAdminFirestore();
  if (!db) return adminSdkMissingResponse();

  try {
    const [membersSnap, invitesSnap] = await Promise.all([
      db.collection("tenant_users").where("tenantId", "==", tenantId).get(),
      db.collection("invites").where("tenantId", "==", tenantId).get(),
    ]);

    const members = membersSnap.docs.map((d) => {
      const data = d.data() as TenantUser;
      return {
        id: d.id,
        userId: data.userId,
        role: data.role,
        status: data.status,
        displayName: data.displayName,
        email: data.email,
      };
    });

    const invites = invitesSnap.docs
      .map((d) => asInvite(d.id, d.data() as Record<string, unknown>))
      .filter((inv) => inv.status === "pending")
      .map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        status: isInviteExpired(inv) ? "expired" : inv.status,
        createdAt: inv.createdAt,
        expiresAt: inv.expiresAt,
      }));

    return NextResponse.json({ tenantId, members, invites });
  } catch {
    return NextResponse.json({ error: "Erro ao carregar a equipe." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const tenantId = params.id?.trim();
  const guard = await requireTenantMember(req, tenantId, "team.manage");
  if (guard.error) return guard.error;
  const db = getAdminFirestore();
  if (!db) return adminSdkMissingResponse();

  let body: { email?: string; role?: string };
  try {
    body = (await req.json()) as { email?: string; role?: string };
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  try {
    const tenantSnap = await db.collection("tenants").doc(tenantId).get();
    if (!tenantSnap.exists) {
      return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
    }
    const tenant = tenantSnap.data() ?? {};

    const membersSnap = await db.collection("tenant_users").where("tenantId", "==", tenantId).get();
    const members = membersSnap.docs.map((d) => d.data() as TenantUser);

    const pendingSnap = await db
      .collection("invites")
      .where("tenantId", "==", tenantId)
      .where("status", "==", "pending")
      .get();
    const pendingEmails = pendingSnap.docs
      .map((d) => asInvite(d.id, d.data() as Record<string, unknown>))
      .filter((inv) => !isInviteExpired(inv))
      .map((inv) => inv.email);

    const role = assertCanCreateInvite({
      actorRole: guard.auth!.role,
      actorEmail: guard.auth!.email,
      targetEmail: body.email ?? "",
      targetRole: body.role ?? "",
      members,
      pendingEmails,
    });

    const token = randomBytes(24).toString("hex");
    const email = normalizeInviteEmail(body.email ?? "");
    await db.collection("invites").doc(token).set({
      tenantId,
      tenantName: String(tenant.tradeName || tenant.name || "Empresa"),
      email,
      role,
      token,
      status: "pending",
      invitedBy: guard.auth!.uid,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: inviteExpiresAt(),
    });

    return NextResponse.json({
      ok: true,
      token,
      email,
      role,
      roleLabel: ROLE_NAMES[role],
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message || "Erro ao criar convite." }, { status: 400 });
  }
}
