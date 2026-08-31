import { describe, expect, it } from "vitest";
import {
  apiKeyPrefixOf,
  checkApiKeyScopes,
  generateApiKey,
  hasApiKeyScope,
  hasAllScopes,
  hashApiKey,
  isApiKeyFormatValid,
  maskApiKey,
  scopeForRequest,
  validateApiKeyState,
} from "./apiKeys";
import type { ApiKey } from "@/types";

function makeKey(overrides: Partial<ApiKey> = {}): ApiKey {
  const now = new Date("2026-01-10T12:00:00Z");
  return {
    id: "key-1",
    tenantId: "tenant-a",
    name: "Integração X",
    prefix: "abcdef12",
    keyHash: hashApiKey("as_abc"),
    scopes: ["appointments:read", "customers:read"],
    active: true,
    createdAt: now,
    ...overrides,
  };
}

describe("apiKeys (Fase 3.13)", () => {
  it("gera chaves no formato esperado e hash consistente", () => {
    const key = generateApiKey();
    expect(isApiKeyFormatValid(key)).toBe(true);
    expect(key.startsWith("as_")).toBe(true);
    expect(hashApiKey(key)).toHaveLength(64);
    expect(hashApiKey(key)).toBe(hashApiKey(key));
    expect(hashApiKey(key)).not.toBe(hashApiKey("outra"));
  });

  it("mascara e extrai prefixo", () => {
    const key = generateApiKey();
    expect(maskApiKey(key)).toContain("...");
    expect(apiKeyPrefixOf(key).length).toBe(8);
  });

  it("valida estado da chave", () => {
    const now = new Date("2026-02-01T12:00:00Z");
    expect(validateApiKeyState(makeKey(), now).ok).toBe(true);
    expect(validateApiKeyState(makeKey({ active: false }), now).ok).toBe(false);
    expect(validateApiKeyState(makeKey({ revokedAt: new Date() }), now).ok).toBe(false);
    expect(
      validateApiKeyState(makeKey({ expiresAt: new Date("2026-01-01T12:00:00Z") }), now).ok
    ).toBe(false);
  });

  it("verifica escopos", () => {
    const scopes = ["appointments:read", "customers:read"] as ApiKey["scopes"];
    expect(hasApiKeyScope(scopes, "appointments:read")).toBe(true);
    expect(hasApiKeyScope(scopes, "appointments:write")).toBe(false);
    expect(hasAllScopes(scopes, ["appointments:read", "customers:read"])).toBe(true);
    expect(hasAllScopes(scopes, ["appointments:read", "appointments:write"])).toBe(false);
    expect(checkApiKeyScopes(scopes, ["appointments:write"]).ok).toBe(false);
    expect(checkApiKeyScopes(scopes, ["customers:read"]).ok).toBe(true);
  });

  it("mapeia método + recurso para escopo", () => {
    expect(scopeForRequest("GET", "appointments")).toBe("appointments:read");
    expect(scopeForRequest("POST", "appointments")).toBe("appointments:write");
    expect(scopeForRequest("get", "customers")).toBe("customers:read");
    expect(scopeForRequest("DELETE", "services")).toBe("services:write");
    expect(scopeForRequest("GET", "professionals")).toBe("professionals:read");
  });
});
