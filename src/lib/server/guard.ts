import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { can, type Permission } from "@/lib/rbac/roles";
import type { Role } from "@/types";
import { getAdminApp, getAdminFirestore } from "./firebaseAdmin";

export type PlatformLevel = "PLATFORM_ADMIN" | "PLATFORM_OWNER";

export interface PlatformAuth {
  uid: string;
  role: string;
}

type GuardResult = { error?: NextResponse; auth?: PlatformAuth };

/**
 * Autentica o chamador via Bearer token (ID token do Firebase) e garante que
 * possui papel de plataforma suficiente (PLATFORM_ADMIN ou PLATFORM_OWNER).
 *
 * As Firestore Rules NÃO permitem que papel de plataforma escreva em
 * `tenants/{id}` (a escrita é restrita a membros do tenant), então as ações de
 * gerenciamento do Painel Master passam obrigatoriamente por aqui (Admin SDK).
 */
export async function requirePlatformRole(
  req: NextRequest,
  min: PlatformLevel
): Promise<GuardResult> {
  const db = getAdminFirestore();
  if (!db) {
    return {
      error: NextResponse.json(
        { error: "Admin SDK não configurado. Configure FIREBASE_SERVICE_ACCOUNT_JSON." },
        { status: 503 }
      ),
    };
  }

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return { error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  }

  try {
    const decoded = await getAuth(getAdminApp()!).verifyIdToken(token);
    const userSnap = await db.collection("users").doc(decoded.uid).get();
    if (!userSnap.exists) {
      return { error: NextResponse.json({ error: "Perfil de usuário não encontrado." }, { status: 403 }) };
    }
    const role = String(userSnap.data()?.platformRole ?? "");
    const allowed =
      role === "PLATFORM_OWNER" || (role === "PLATFORM_ADMIN" && min === "PLATFORM_ADMIN");
    if (!allowed) {
      return {
        error: NextResponse.json(
          { error: "Acesso negado: papel de plataforma insuficiente." },
          { status: 403 }
        ),
      };
    }
    return { auth: { uid: decoded.uid, role } };
  } catch {
    return { error: NextResponse.json({ error: "Token inválido ou expirado." }, { status: 401 }) };
  }
}

export interface TenantAuth {
  uid: string;
  email: string;
  role: Role;
  tenantId: string;
}

type TenantGuardResult = { error?: NextResponse; auth?: TenantAuth };

export async function requireTenantMember(
  req: NextRequest,
  tenantId: string,
  permission: Permission
): Promise<TenantGuardResult> {
  const db = getAdminFirestore();
  if (!db) {
    return {
      error: NextResponse.json(
        { error: "Admin SDK não configurado. Configure FIREBASE_SERVICE_ACCOUNT_JSON." },
        { status: 503 }
      ),
    };
  }

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return { error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  }
  if (!tenantId) {
    return { error: NextResponse.json({ error: "Empresa inválida." }, { status: 400 }) };
  }

  try {
    const decoded = await getAuth(getAdminApp()!).verifyIdToken(token);
    const memberSnap = await db.collection("tenant_users").doc(`${decoded.uid}_${tenantId}`).get();
    if (!memberSnap.exists) {
      return { error: NextResponse.json({ error: "Você não pertence a esta empresa." }, { status: 403 }) };
    }
    const data = memberSnap.data() ?? {};
    if (data.status !== "active") {
      return { error: NextResponse.json({ error: "Associação inativa nesta empresa." }, { status: 403 }) };
    }
    const role = data.role as Role;
    if (!can(role, permission)) {
      return { error: NextResponse.json({ error: "Permissão insuficiente." }, { status: 403 }) };
    }
    return {
      auth: {
        uid: decoded.uid,
        email: String(decoded.email ?? data.email ?? ""),
        role,
        tenantId,
      },
    };
  } catch {
    return { error: NextResponse.json({ error: "Token inválido ou expirado." }, { status: 401 }) };
  }
}
