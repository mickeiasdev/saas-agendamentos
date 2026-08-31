import { createHash, randomBytes } from "node:crypto";
import type { ApiKey, ApiKeyScope } from "@/types";

/**
 * API Keys (Fase 3.13).
 *
 * Lógica pura de chaves de API: geração, hashing, máscara, escopos, expiração
 * e rate limit. A chave completa é mostrada apenas uma vez na criação; apenas
 * o hash é armazenado, seguindo boas práticas (nunca armazenar o segredo).
 */

export const API_KEY_PREFIX = "as";
export const API_KEY_LENGTH = 32;

/** Gera uma chave de API no formato `as_<base64url>`. */
export function generateApiKey(): string {
  const random = randomBytes(API_KEY_LENGTH).toString("base64url");
  return `${API_KEY_PREFIX}_${random}`;
}

/** Hash SHA-256 hex da chave (o que é persistido). */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

/** Retorna o prefixo para exibição (ex.: `as_abc1...`). */
export function maskApiKey(key: string, visible = 8): string {
  if (key.length <= visible + 4) return key;
  return `${key.slice(0, visible)}...`;
}

export function apiKeyPrefixOf(key: string): string {
  const parts = key.split("_");
  return parts.length === 2 ? parts[1].slice(0, 8) : key.slice(0, 8);
}

export function isApiKeyFormatValid(key: string): boolean {
  return /^as_[A-Za-z0-9_-]{20,}$/.test(key);
}

export interface ApiKeyValidationResult {
  ok: boolean;
  error?: string;
}

/** Valida status, expiração e revogação de uma chave. */
export function validateApiKeyState(
  key: Pick<ApiKey, "active" | "expiresAt" | "revokedAt">,
  now: Date
): ApiKeyValidationResult {
  if (!key.active) return { ok: false, error: "Chave de API inativa." };
  if (key.revokedAt) return { ok: false, error: "Chave de API revogada." };
  if (key.expiresAt) {
    const expires = key.expiresAt instanceof Date ? key.expiresAt : key.expiresAt?.toDate?.() ?? new Date(String(key.expiresAt));
    if (now.getTime() > expires.getTime()) {
      return { ok: false, error: "Chave de API expirada." };
    }
  }
  return { ok: true };
}

export function hasApiKeyScope(scopes: ApiKeyScope[], required: ApiKeyScope): boolean {
  return scopes.includes(required);
}

/** Verifica se a chave possui todos os escopos exigidos. */
export function hasAllScopes(scopes: ApiKeyScope[], required: ApiKeyScope[]): boolean {
  return required.every((r) => hasApiKeyScope(scopes, r));
}

export interface ScopeCheckResult {
  ok: boolean;
  error?: string;
}

export function checkApiKeyScopes(scopes: ApiKeyScope[], required: ApiKeyScope[]): ScopeCheckResult {
  const missing = required.filter((r) => !hasApiKeyScope(scopes, r));
  if (missing.length > 0) {
    return { ok: false, error: `Permissão insuficiente. Escopos necessários: ${missing.join(", ")}.` };
  }
  return { ok: true };
}

/** Mapeia método HTTP + recurso para o escopo exigido. */
export function scopeForRequest(method: string, resource: "appointments" | "customers" | "services" | "professionals"): ApiKeyScope {
  const action = method.toUpperCase() === "GET" ? "read" : "write";
  return `${resource}:${action}` as ApiKeyScope;
}
