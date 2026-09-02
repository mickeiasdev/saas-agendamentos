import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Camada server-only (API routes) do Firebase Admin SDK.
 *
 * Usa credenciais da service account definidas em variáveis de ambiente
 * server-only (NUNCA NEXT_PUBLIC_*). Se não estiver configurado, retorna null
 * e as API routes respondem com erro claro orientando a configuração.
 *
 * Apoia três formatos:
 *   - FIREBASE_SERVICE_ACCOUNT_JSON: JSON completo da service account
 *   - FIREBASE_SERVICE_ACCOUNT_PATH ou arquivo ./firebase-adminsdk.json
 *   - FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY + FIREBASE_PROJECT_ID
 */

function parseServiceAccount(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function loadServiceAccountFromFile(): Record<string, unknown> | null {
  const configured = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  const filePath = configured || resolve(process.cwd(), "firebase-adminsdk.json");
  if (!existsSync(filePath)) return null;
  try {
    return parseServiceAccount(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

export interface AdminCredentials {
  projectId: string;
  serviceAccount?: Record<string, unknown>;
  clientEmail?: string;
  privateKey?: string;
}

export function resolveAdminCredentials(): AdminCredentials | null {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (serviceAccountJson) {
    const parsed = parseServiceAccount(serviceAccountJson);
    if (parsed) {
      const projectId =
        (typeof parsed.project_id === "string" && parsed.project_id) ||
        process.env.FIREBASE_PROJECT_ID ||
        "";
      if (projectId) return { projectId, serviceAccount: parsed };
    }
  }

  const fromFile = loadServiceAccountFromFile();
  if (fromFile) {
    const projectId =
      (typeof fromFile.project_id === "string" && fromFile.project_id) ||
      process.env.FIREBASE_PROJECT_ID ||
      "";
    if (projectId) return { projectId, serviceAccount: fromFile };
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
  "Firebase Admin SDK não configurado. Defina FIREBASE_SERVICE_ACCOUNT_JSON, coloque firebase-adminsdk.json na raiz, ou use FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.";

export function adminSdkMissingResponse(status = 503): Response {
  return Response.json({ error: ADMIN_SDK_MISSING_MESSAGE, ok: false }, { status });
}
