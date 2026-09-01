import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { FakeFirestore, type FakeFirestore as FakeDb } from "@/lib/booking/fakeFirestore";
import {
  MemoryRateLimitStore,
  authorizeApiRequest,
  createApiKey,
  extractBearerToken,
  getApiKey,
  listApiKeyLogs,
  listApiKeys,
  resolveApiKey,
  revokeApiKey,
  rotateApiKey,
  validateCreateApiKeyInput,
} from "./apiKeys";
import { generateApiKey, hashApiKey } from "@/lib/apiKeys";

function seedKey(db: FakeDb, opts: { tenantId?: string; active?: boolean; revokedAt?: Date | null; expiresAt?: Date | null } = {}) {
  const tenantId = opts.tenantId ?? "t1";
  const secret = generateApiKey();
  db.store.set(`tenants/${tenantId}/api_keys/k1`, {
    tenantId,
    name: "Integração X",
    prefix: secret.slice(0, 10),
    keyHash: hashApiKey(secret),
    scopes: ["appointments:read", "customers:read", "services:read"],
    active: opts.active ?? true,
    expiresAt: opts.expiresAt ?? null,
    revokedAt: opts.revokedAt ?? null,
    lastUsedAt: null,
    createdAt: new Date("2026-01-01T12:00:00Z"),
  });
  return { tenantId, secret };
}

function reqWith(authorization?: string, url = "http://localhost/api/v1/services"): NextRequest {
  return new NextRequest(url, { headers: authorization ? { authorization } : {} });
}

describe("apiKeys server (Fase 3.13)", () => {
  it("extrai o Bearer token", () => {
    expect(extractBearerToken(reqWith("Bearer as_abc123"))).toBe("as_abc123");
    expect(extractBearerToken(reqWith("bearer  abc"))).toBe("abc");
    expect(extractBearerToken(reqWith())).toBeNull();
    expect(extractBearerToken(reqWith("Basic xyz"))).toBeNull();
  });

  it("resolve chave pelo hash, ignorando revogadas/expiradas", async () => {
    const db = new FakeFirestore();
    const { tenantId, secret } = seedKey(db);

    const resolved = await resolveApiKey(db as never, secret);
    expect(resolved).not.toBeNull();
    expect(resolved!.tenantId).toBe(tenantId);
    expect(resolved!.apiKey.id).toBe("k1");

    const db2 = new FakeFirestore();
    seedKey(db2, { active: false });
    expect(await resolveApiKey(db2 as never, secret)).toBeNull();

    const db3 = new FakeFirestore();
    seedKey(db3, { revokedAt: new Date() });
    expect(await resolveApiKey(db3 as never, secret)).toBeNull();

    const db4 = new FakeFirestore();
    seedKey(db4, { expiresAt: new Date("2020-01-01T00:00:00Z") });
    expect(await resolveApiKey(db4 as never, secret)).toBeNull();
  });

  it("rejeita chaves com formato inválido sem consultar o banco", async () => {
    const db = new FakeFirestore();
    expect(await resolveApiKey(db as never, "chave-invalida")).toBeNull();
  });

  it("cria, lista, revoga e rotaciona chaves via Admin SDK", async () => {
    const db = new FakeFirestore();
    const created = await createApiKey(db as never, "t1", {
      name: "Integração X",
      scopes: ["customers:read"],
      expiresAt: null,
    });
    expect(created.secret.startsWith("as_")).toBe(true);
    expect(created.apiKeyId).toBeTruthy();

    const listed = await listApiKeys(db as never, "t1");
    expect(listed).toHaveLength(1);
    expect(listed[0].name).toBe("Integração X");
    expect(listed[0].keyHash).toBe(hashApiKey(created.secret));

    const rotated = await rotateApiKey(db as never, "t1", created.apiKeyId);
    expect(rotated).not.toBeNull();
    expect(rotated!.secret).not.toBe(created.secret);
    const after = await getApiKey(db as never, "t1", created.apiKeyId);
    expect(after!.keyHash).toBe(hashApiKey(rotated!.secret));

    await revokeApiKey(db as never, "t1", created.apiKeyId);
    const revoked = await getApiKey(db as never, "t1", created.apiKeyId);
    expect(revoked!.active).toBe(false);
    expect(revoked!.revokedAt).toBeTruthy();
  });

  it("valida entrada de criação de chave", () => {
    expect(validateCreateApiKeyInput({ name: "  ", scopes: ["x:read"] }).ok).toBe(false);
    expect(validateCreateApiKeyInput({ name: "K", scopes: [] }).ok).toBe(false);
    expect(validateCreateApiKeyInput({ name: "K", scopes: ["nope:read"] }).ok).toBe(false);
    expect(validateCreateApiKeyInput({ name: "K", scopes: ["customers:read"], expiresAt: "invalido" }).ok).toBe(false);

    const ok = validateCreateApiKeyInput({ name: "K", scopes: ["customers:read", "customers:read"], expiresAt: "2027-01-01T00:00:00Z" });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.data.scopes).toEqual(["customers:read"]);
      expect(ok.data.expiresAt).toBeInstanceOf(Date);
    }
  });

  it("autoriza requisição com chave e escopo corretos", async () => {
    const db = new FakeFirestore();
    const { tenantId, secret } = seedKey(db);

    const result = await authorizeApiRequest(db as never, reqWith(`Bearer ${secret}`), "appointments:read");
    expect(result.error).toBeUndefined();
    expect(result.context).toBeDefined();
    expect(result.context!.tenantId).toBe(tenantId);

    const logs = await listApiKeyLogs(db as never, tenantId, { apiKeyId: "k1" });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].path).toBe("/api/v1/services");
    expect(logs[0].status).toBe(200);
  });

  it("bloqueia sem token, com chave inválida e com escopo insuficiente", async () => {
    const db = new FakeFirestore();
    const { tenantId, secret } = seedKey(db);

    const noToken = await authorizeApiRequest(db as never, reqWith(), "appointments:read");
    expect(noToken.error?.status).toBe(401);

    const invalid = await authorizeApiRequest(db as never, reqWith("Bearer as_invalidaaaaaaaaaaaaaaaaaa"), "appointments:read");
    expect(invalid.error?.status).toBe(401);

    const noScope = await authorizeApiRequest(db as never, reqWith(`Bearer ${secret}`), "customers:write");
    expect(noScope.error?.status).toBe(403);

    const deniedLogs = await listApiKeyLogs(db as never, tenantId, { apiKeyId: "k1" });
    expect(deniedLogs.some((l) => l.status === 403)).toBe(true);
  });

  it("aplica rate limit por chave", async () => {
    const db = new FakeFirestore();
    const { secret } = seedKey(db);
    const store = new MemoryRateLimitStore();
    const key = "t1:k1";
    expect(await store.get(key)).toBeUndefined();
    await store.set(key, { key, hits: [Date.now()] });
    expect((await store.get(key))!.hits).toHaveLength(1);
  });
});
