import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Camada server-only (API routes) do Firebase Admin SDK.
 *
 * Usa credenciais da service account definidas em variáveis de ambiente
 * server-only (NUNCA NEXT_PUBLIC_*). Se não estiver configurado, retorna null
 * e as API routes respondem com erro claro orientando a configuração.
 *
 * Apoia dois formatos:
 *   - FIREBASE_SERVICE_ACCOUNT_JSON: JSON completo da service account
 *   - FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY + FIREBASE_PROJECT_ID
 */
export function getAdminApp(): App | null {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) return null;
  const existing = getApps();
  if (existing.length > 0) return existing[0];

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccount) {
    try {
      return initializeApp({ credential: cert(JSON.parse(serviceAccount)), projectId });
    } catch {
      return null;
    }
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (clientEmail && privateKey) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, "\n"),
      }),
      projectId,
    });
  }

  return null;
}

export function getAdminFirestore(): Firestore | null {
  const app = getAdminApp();
  return app ? getFirestore(app) : null;
}

export const ADMIN_SDK_MISSING_MESSAGE =
  "Firebase Admin SDK não configurado. Defina FIREBASE_SERVICE_ACCOUNT_JSON ou FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.";

export function adminSdkMissingResponse(status = 503): Response {
  return Response.json({ error: ADMIN_SDK_MISSING_MESSAGE, ok: false }, { status });
}
