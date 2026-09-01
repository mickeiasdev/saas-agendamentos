import { NextRequest, NextResponse } from "next/server";
import { FieldValue, type DocumentReference, type Firestore } from "firebase-admin/firestore";
import type { ApiKey, ApiKeyLog, ApiKeyScope } from "@/types";
import {
  checkApiKeyScopes,
  generateApiKey,
  hashApiKey,
  isApiKeyFormatValid,
  validateApiKeyState,
} from "@/lib/apiKeys";
import {
  DEFAULT_API_RATE_LIMIT,
  evaluateRateLimit,
  makeRateWindow,
  type RateWindow,
} from "@/lib/rateLimit";

/**
 * API Keys (Fase 3.13) — lado servidor.
 *
 * Autenticação de chamadas à API pública via `Authorization: Bearer as_...`,
 * resolução da chave pelo hash (collection group `api_keys`), verificação de
 * estado e escopos, rate limit e registro de logs de uso. Também expõe as
 * operações administrativas (criar, listar, revogar, rotacionar e logs).
 *
 * Tudo roda no Admin SDK, que ignora as Firestore Rules — a autenticação da
 * chave acontece aqui, no servidor.
 */

export const API_KEY_SCOPES: ApiKeyScope[] = [
  "appointments:read",
  "appointments:write",
  "customers:read",
  "customers:write",
  "services:read",
  "professionals:read",
];

export function extractBearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return m ? m[1] : null;
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "";
}

export interface ResolvedApiKey {
  tenantId: string;
  apiKey: ApiKey;
  ref: DocumentReference;
}

/**
 * Localiza uma chave pelo segredo em qualquer tenant. Retorna apenas chaves
 * ativas, não expiradas e não revogadas.
 */
export async function resolveApiKey(db: Firestore, secret: string): Promise<ResolvedApiKey | null> {
  if (!isApiKeyFormatValid(secret)) return null;
  const keyHash = hashApiKey(secret);
  const snap = await db.collectionGroup("api_keys").where("keyHash", "==", keyHash).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  const m = /^tenants\/([^/]+)\/api_keys\/([^/]+)$/.exec(doc.ref.path);
  if (!m) return null;
  const tenantId = m[1];
  const apiKey = { id: m[2], tenantId, ...doc.data() } as ApiKey;
  const validation = validateApiKeyState(apiKey, new Date());
  if (!validation.ok) return null;
  return { tenantId, apiKey, ref: doc.ref };
}

// ---------- Rate limit ----------

export interface RateLimitStore {
  get(key: string): Promise<RateWindow | undefined>;
  set(key: string, window: RateWindow): Promise<void>;
}

/** Store em memória (custo zero; perde estado em cold start). */
export class MemoryRateLimitStore implements RateLimitStore {
  private map = new Map<string, RateWindow>();
  get(key: string): Promise<RateWindow | undefined> {
    return Promise.resolve(this.map.get(key));
  }
  set(key: string, window: RateWindow): Promise<void> {
    this.map.set(key, window);
    return Promise.resolve();
  }
}

/** Store persistente no Firestore (ativação futura, ver FREE_TIER.md). */
export class FirestoreRateLimitStore implements RateLimitStore {
  constructor(private db: Firestore) {}
  async get(key: string): Promise<RateWindow | undefined> {
    const snap = await this.db.doc(`api_rate_limits/${key}`).get();
    if (!snap.exists) return undefined;
    const data = snap.data() as { key?: string; hits?: number[] };
    return { key: String(data.key ?? key), hits: Array.isArray(data.hits) ? data.hits : [] };
  }
  async set(key: string, window: RateWindow): Promise<void> {
    await this.db.doc(`api_rate_limits/${key}`).set({ key, hits: window.hits });
  }
}

let memoryStore: MemoryRateLimitStore | null = null;

export function getRateLimitStore(db?: Firestore | null): RateLimitStore {
  if (db) return new FirestoreRateLimitStore(db);
  memoryStore ??= new MemoryRateLimitStore();
  return memoryStore;
}

// ---------- Logs ----------

export async function logApiKeyUsage(
  db: Firestore,
  tenantId: string,
  input: { apiKeyId: string; method: string; path: string; status: number; ip?: string }
): Promise<void> {
  await db
    .collection("tenants")
    .doc(tenantId)
    .collection("api_key_logs")
    .add({
      tenantId,
      apiKeyId: input.apiKeyId,
      method: input.method,
      path: input.path,
      status: input.status,
      ip: input.ip ?? null,
      createdAt: FieldValue.serverTimestamp(),
    });
}

// ---------- Autorização de requisições ----------

export type AuthorizeResult =
  | { error: NextResponse; context?: undefined }
  | { error?: undefined; context: { tenantId: string; apiKeyId: string; apiKey: ApiKey } };

/**
 * Pipeline completo de autenticação de uma chamada à API pública:
 * Bearer token → resolução → estado/escopo → rate limit → log de uso.
 */
export async function authorizeApiRequest(
  db: Firestore,
  req: NextRequest,
  requiredScope: ApiKeyScope
): Promise<AuthorizeResult> {
  const token = extractBearerToken(req);
  if (!token) {
    return {
      error: NextResponse.json(
        { error: "API key ausente. Use o header Authorization: Bearer <chave>." },
        { status: 401 }
      ),
    };
  }

  const resolved = await resolveApiKey(db, token);
  if (!resolved) {
    return {
      error: NextResponse.json(
        { error: "API key inválida, revogada ou expirada." },
        { status: 401 }
      ),
    };
  }

  const { tenantId, apiKey, ref } = resolved;
  const scopeCheck = checkApiKeyScopes(apiKey.scopes, [requiredScope]);
  if (!scopeCheck.ok) {
    await logApiKeyUsage(db, tenantId, {
      apiKeyId: apiKey.id,
      method: req.method,
      path: req.nextUrl.pathname,
      status: 403,
      ip: clientIp(req),
    });
    return {
      error: NextResponse.json(
        { error: scopeCheck.error ?? "Permissão insuficiente." },
        { status: 403 }
      ),
    };
  }

  const store = getRateLimitStore(db);
  const rateKey = `${tenantId}:${apiKey.id}`;
  const window = (await store.get(rateKey)) ?? makeRateWindow(rateKey);
  const result = evaluateRateLimit(window, DEFAULT_API_RATE_LIMIT, Date.now());
  await store.set(rateKey, result.nextWindow);
  if (!result.allowed) {
    await logApiKeyUsage(db, tenantId, {
      apiKeyId: apiKey.id,
      method: req.method,
      path: req.nextUrl.pathname,
      status: 429,
      ip: clientIp(req),
    });
    return {
      error: NextResponse.json(
        { error: "Limite de requisições excedido. Tente novamente em instantes." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.max(1, Math.ceil(result.retryAfterMs / 1000))) },
        }
      ),
    };
  }

  await Promise.all([
    logApiKeyUsage(db, tenantId, {
      apiKeyId: apiKey.id,
      method: req.method,
      path: req.nextUrl.pathname,
      status: 200,
      ip: clientIp(req),
    }),
    ref.update({ lastUsedAt: FieldValue.serverTimestamp() }),
  ]);

  return { context: { tenantId, apiKeyId: apiKey.id, apiKey } };
}

// ---------- Gestão administrativa ----------

export interface CreateApiKeyInput {
  name: string;
  scopes: ApiKeyScope[];
  expiresAt?: Date | null;
}

export type CreateApiKeyValidation =
  | { ok: true; data: { name: string; scopes: ApiKeyScope[]; expiresAt: Date | null } }
  | { ok: false; error: string };

export function validateCreateApiKeyInput(input: unknown): CreateApiKeyValidation {
  const body = (input ?? {}) as { name?: unknown; scopes?: unknown; expiresAt?: unknown };

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return { ok: false, error: "Informe um nome para a chave." };
  if (name.length > 80) return { ok: false, error: "O nome deve ter no máximo 80 caracteres." };

  const scopes = Array.isArray(body.scopes)
    ? [...new Set(body.scopes.map(String))]
    : [];
  if (scopes.length === 0) {
    return { ok: false, error: "Informe ao menos uma permissão (ex.: customers:read)." };
  }
  for (const s of scopes) {
    if (!(API_KEY_SCOPES as string[]).includes(s)) {
      return { ok: false, error: `Permissão inválida: ${s}.` };
    }
  }

  let expiresAt: Date | null = null;
  if (body.expiresAt != null && body.expiresAt !== "") {
    const d = new Date(String(body.expiresAt));
    if (Number.isNaN(d.getTime())) {
      return { ok: false, error: "Data de expiração inválida." };
    }
    expiresAt = d;
  }

  return { ok: true, data: { name, scopes: scopes as ApiKeyScope[], expiresAt } };
}

export interface CreateApiKeyResult {
  apiKeyId: string;
  /** Chave completa — exibida apenas uma vez. */
  secret: string;
}

export async function createApiKey(
  db: Firestore,
  tenantId: string,
  input: CreateApiKeyInput
): Promise<CreateApiKeyResult> {
  const secret = generateApiKey();
  const ref = await db.collection("tenants").doc(tenantId).collection("api_keys").add({
    tenantId,
    name: input.name.trim(),
    prefix: secret.slice(0, 10),
    keyHash: hashApiKey(secret),
    scopes: input.scopes,
    active: true,
    expiresAt: input.expiresAt ?? null,
    lastUsedAt: null,
    createdAt: FieldValue.serverTimestamp(),
    revokedAt: null,
  });
  return { apiKeyId: ref.id, secret };
}

export async function listApiKeys(db: Firestore, tenantId: string): Promise<ApiKey[]> {
  const snap = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("api_keys")
    .orderBy("createdAt", "desc")
    .limit(200)
    .get();
  return snap.docs.map((d) => ({ id: d.id, tenantId, ...d.data() }) as ApiKey);
}

export async function getApiKey(db: Firestore, tenantId: string, keyId: string): Promise<ApiKey | null> {
  const snap = await db.collection("tenants").doc(tenantId).collection("api_keys").doc(keyId).get();
  if (!snap.exists) return null;
  return { id: keyId, tenantId, ...snap.data() } as ApiKey;
}

export async function revokeApiKey(db: Firestore, tenantId: string, keyId: string): Promise<void> {
  await db.collection("tenants").doc(tenantId).collection("api_keys").doc(keyId).update({
    active: false,
    revokedAt: FieldValue.serverTimestamp(),
  });
}

export async function rotateApiKey(
  db: Firestore,
  tenantId: string,
  keyId: string
): Promise<CreateApiKeyResult | null> {
  const key = await getApiKey(db, tenantId, keyId);
  if (!key) return null;
  const secret = generateApiKey();
  await db.collection("tenants").doc(tenantId).collection("api_keys").doc(keyId).update({
    keyHash: hashApiKey(secret),
    prefix: secret.slice(0, 10),
    active: true,
    revokedAt: null,
    lastUsedAt: null,
  });
  return { apiKeyId: keyId, secret };
}

export async function listApiKeyLogs(
  db: Firestore,
  tenantId: string,
  opts: { apiKeyId?: string; limit?: number } = {}
): Promise<ApiKeyLog[]> {
  const size = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  const snap = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("api_key_logs")
    .orderBy("createdAt", "desc")
    .limit(size)
    .get();
  const logs = snap.docs.map((d) => ({ id: d.id, tenantId, ...d.data() }) as ApiKeyLog);
  return opts.apiKeyId ? logs.filter((l) => l.apiKeyId === opts.apiKeyId) : logs;
}
