import {
  addDoc,
  doc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { tenantCollections } from "./collections";
import type { ApiKey, ApiKeyScope } from "@/types";
import { generateApiKey, hashApiKey, validateApiKeyState } from "@/lib/apiKeys";

const keysFor = (tenantId: string) => tenantCollections(getFirebaseFirestore(), tenantId).apiKeys();
const logsFor = (tenantId: string) => tenantCollections(getFirebaseFirestore(), tenantId).apiKeyLogs();

export interface CreateApiKeyResult {
  apiKeyId: string;
  /** Chave completa — exibida apenas uma vez. */
  secret: string;
}

export interface CreateApiKeyInput {
  name: string;
  scopes: ApiKeyScope[];
  expiresAt?: Date | null;
}

export async function createApiKey(tenantId: string, input: CreateApiKeyInput): Promise<CreateApiKeyResult> {
  const secret = generateApiKey();
  const ref = await addDoc(keysFor(tenantId), {
    tenantId,
    name: input.name.trim(),
    prefix: secret.slice(0, 10),
    keyHash: hashApiKey(secret),
    scopes: input.scopes,
    active: true,
    expiresAt: input.expiresAt ?? null,
    lastUsedAt: null,
    createdAt: serverTimestamp(),
    revokedAt: null,
  });
  return { apiKeyId: ref.id, secret };
}

export async function listApiKeys(tenantId: string): Promise<ApiKey[]> {
  const snap = await getDocs(query(keysFor(tenantId), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ApiKey);
}

export async function revokeApiKey(tenantId: string, keyId: string): Promise<void> {
  await updateDoc(doc(keysFor(tenantId), keyId), {
    active: false,
    revokedAt: serverTimestamp(),
  });
}

export async function rotateApiKey(tenantId: string, keyId: string): Promise<CreateApiKeyResult | null> {
  const snap = await getDocs(query(keysFor(tenantId), where("__name__", "==", keyId)));
  if (snap.empty) return null;
  const current = { id: snap.docs[0].id, ...snap.docs[0].data() } as ApiKey;
  const secret = generateApiKey();
  await updateDoc(doc(keysFor(tenantId), keyId), {
    keyHash: hashApiKey(secret),
    prefix: secret.slice(0, 10),
    active: true,
    revokedAt: null,
    lastUsedAt: null,
  });
  return { apiKeyId: current.id, secret };
}

/**
 * Localiza uma chave pelo hash do segredo. Retorna apenas se estiver ativa,
 * não expirada e não revogada.
 */
export async function findApiKeyBySecret(
  tenantId: string,
  secret: string
): Promise<ApiKey | null> {
  const keyHash = hashApiKey(secret);
  const snap = await getDocs(query(keysFor(tenantId), where("keyHash", "==", keyHash), limit(1)));
  if (snap.empty) return null;
  const key = { id: snap.docs[0].id, ...snap.docs[0].data() } as ApiKey;
  const validation = validateApiKeyState(key, new Date());
  if (!validation.ok) return null;
  return key;
}

export async function touchApiKey(tenantId: string, keyId: string): Promise<void> {
  await updateDoc(doc(keysFor(tenantId), keyId), { lastUsedAt: serverTimestamp() });
}

export async function logApiKeyUsage(
  tenantId: string,
  input: { apiKeyId: string; method: string; path: string; status: number; ip?: string }
): Promise<void> {
  await addDoc(logsFor(tenantId), {
    tenantId,
    apiKeyId: input.apiKeyId,
    method: input.method,
    path: input.path,
    status: input.status,
    ip: input.ip ?? null,
    createdAt: serverTimestamp(),
  });
}
