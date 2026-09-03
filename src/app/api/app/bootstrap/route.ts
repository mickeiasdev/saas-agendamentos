import { NextRequest } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import {
  adminSdkMissingResponse,
  getAdminApp,
  getAdminFirestore,
} from "@/lib/server/firebaseAdmin";
import { configuredOwnerEmail, resolveBootstrapRole } from "@/lib/platform";

export const dynamic = "force-dynamic";

/**
 * POST /api/app/bootstrap
 * Promove o primeiro usuário (ou o e-mail em PLATFORM_OWNER_EMAIL) a PLATFORM_OWNER.
 * Seguro: só o Admin SDK escreve platformRole.
 */
export async function POST(req: NextRequest) {
  const db = getAdminFirestore();
  if (!db) return adminSdkMissingResponse();

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const decoded = await getAuth(getAdminApp()!).verifyIdToken(token);
    const uid = decoded.uid;
    const email = String(decoded.email ?? "");
    const userRef = db.collection("users").doc(uid);
    const lockRef = db.collection("platform").doc("config");

    const result = await db.runTransaction(async (tx) => {
      const [snap, lock] = await Promise.all([tx.get(userRef), tx.get(lockRef)]);
      const current = (snap.data()?.platformRole as string | undefined) ?? "USER";
      if (current === "PLATFORM_OWNER" || current === "PLATFORM_ADMIN") {
        return { role: current, promoted: false };
      }

      const ownerAlreadyExists = Boolean(lock.data()?.ownerUserId);
      const role = resolveBootstrapRole({
        email,
        ownerAlreadyExists,
        configuredOwnerEmail: configuredOwnerEmail(),
      });
      if (role !== "PLATFORM_OWNER") {
        return { role: current, promoted: false };
      }

      tx.set(
        userRef,
        {
          uid,
          email,
          platformRole: "PLATFORM_OWNER",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      tx.set(lockRef, {
        ownerUserId: uid,
        ownerEmail: email,
        createdAt: FieldValue.serverTimestamp(),
      });
      return { role: "PLATFORM_OWNER", promoted: true };
    });

    return Response.json({ ok: true, ...result });
  } catch {
    return Response.json({ error: "Token inválido ou expirado." }, { status: 401 });
  }
}
