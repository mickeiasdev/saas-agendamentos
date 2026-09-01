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
 *     (não exige FIREBASE_PROJECT_ID à parte — o project_id vem do JSON)
 *   - FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY + FIREBASE_PROJECT_ID
 */

export interface AdminCredentials {
  projectId: string;
  serviceAccount?: Record<string, unknown>;
  clientEmail?: string;
  privateKey?: string;
}

export function resolveAdminCredentials(): AdminCredentials | null {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (serviceAccountJson) {
    try {
      const parsed = JSON.parse(serviceAccountJson) as Record<string, unknown>;
      const projectId =
        (typeof parsed.project_id === "string" && parsed.project_id) ||
        process.env.FIREBASE_PROJECT_ID ||
        "";
      if (projectId) return { projectId, serviceAccount: parsed };
    } catch {
      return null;
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (projectId && clientEmail && privateKey) {
    return {
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, "\n"),
    };
  }
  return null;
}

export function getAdminApp(): App | null {
  const existing = getApps();
  if (existing.length > 0) return existing[0];

  const creds = resolveAdminCredentials();
  if (!creds) return null;

  try {
    if (creds.serviceAccount) {
      return initializeApp({
        credential: cert(creds.serviceAccount as never),
        projectId: creds.projectId,
      });
    }
    if (creds.clientEmail && creds.privateKey) {
      return initializeApp({
        credential: cert({
          projectId: creds.projectId,
          clientEmail: creds.clientEmail,
          privateKey: creds.privateKey,
        }),
        projectId: creds.projectId,
      });
    }
  } catch {
    return null;
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
