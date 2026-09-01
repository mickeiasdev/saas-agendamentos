import { afterEach, describe, expect, it } from "vitest";
import { ADMIN_SDK_MISSING_MESSAGE, adminSdkMissingResponse, resolveAdminCredentials } from "./firebaseAdmin";

const KEYS = [
  "FIREBASE_SERVICE_ACCOUNT_JSON",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
] as const;

const original: Record<string, string | undefined> = {};

function snapshotEnv() {
  for (const k of KEYS) original[k] = process.env[k];
}

function restoreEnv() {
  for (const k of KEYS) {
    if (original[k] === undefined) delete process.env[k];
    else process.env[k] = original[k];
  }
}

function clearEnv() {
  for (const k of KEYS) delete process.env[k];
}

snapshotEnv();

afterEach(() => {
  restoreEnv();
});

describe("cancel/book sem Admin SDK", () => {
  it("responde 503 com ok:false em vez de lançar", async () => {
    const res = adminSdkMissingResponse();
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string; ok: boolean };
    expect(body.ok).toBe(false);
    expect(body.error).toBe(ADMIN_SDK_MISSING_MESSAGE);
  });

  it("resolve credenciais só com FIREBASE_SERVICE_ACCOUNT_JSON (sem FIREBASE_PROJECT_ID)", () => {
    clearEnv();
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      type: "service_account",
      project_id: "demo-project",
      client_email: "sa@demo.iam.gserviceaccount.com",
      private_key: "-----BEGIN PRIVATE KEY-----\\nfake\\n-----END PRIVATE KEY-----\\n",
    });
    const creds = resolveAdminCredentials();
    expect(creds).not.toBeNull();
    expect(creds?.projectId).toBe("demo-project");
    expect(creds?.serviceAccount).toBeTruthy();
  });

  it("retorna null quando nenhuma credencial existe (bug histórico do cancel 500)", () => {
    clearEnv();
    expect(resolveAdminCredentials()).toBeNull();
  });

  it("aceita FIREBASE_PROJECT_ID + CLIENT_EMAIL + PRIVATE_KEY", () => {
    clearEnv();
    process.env.FIREBASE_PROJECT_ID = "demo-project";
    process.env.FIREBASE_CLIENT_EMAIL = "sa@demo.iam.gserviceaccount.com";
    process.env.FIREBASE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\\nfake\\n-----END PRIVATE KEY-----\\n";
    const creds = resolveAdminCredentials();
    expect(creds?.projectId).toBe("demo-project");
    expect(creds?.clientEmail).toBe("sa@demo.iam.gserviceaccount.com");
    expect(creds?.privateKey).toContain("BEGIN PRIVATE KEY");
  });
});
