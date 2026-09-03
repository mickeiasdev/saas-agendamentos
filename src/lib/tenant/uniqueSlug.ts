import { isReservedSlug, slugify } from "@/lib/tenant/slug";

export const SLUG_MAX_LENGTH = 48;
export const SLUG_TAKEN_MESSAGE = "Este endereço público já está em uso. Tente outro nome da empresa.";

export function validateTenantSlug(raw: string): string {
  const slug = slugify(raw);
  if (!slug || slug.length < 2) {
    throw new Error("Informe um nome com pelo menos 2 letras ou números para gerar o endereço do site.");
  }
  return slug.length > SLUG_MAX_LENGTH ? slug.slice(0, SLUG_MAX_LENGTH).replace(/-+$/, "") : slug;
}

export function slugCandidate(base: string, attempt: number): string {
  const n = Math.max(1, attempt);
  if (n === 1) return base;
  const suffix = `-${n}`;
  const trimmed = base.slice(0, Math.max(1, SLUG_MAX_LENGTH - suffix.length)).replace(/-+$/, "");
  return `${trimmed}${suffix}`;
}

export function firstSlugAttempt(base: string): number {
  return isReservedSlug(base) ? 2 : 1;
}

export function assertSlugClaimable(raw: string): string {
  const slug = validateTenantSlug(raw);
  if (isReservedSlug(slug)) {
    throw new Error("Este endereço é reservado pela plataforma. Escolha outro.");
  }
  return slug;
}

export async function claimExactSlug(
  raw: string,
  isTaken: (slug: string) => Promise<boolean>
): Promise<string> {
  const slug = assertSlugClaimable(raw);
  if (await isTaken(slug)) throw new Error(SLUG_TAKEN_MESSAGE);
  return slug;
}

export async function allocateUniqueSlug(
  raw: string,
  isTaken: (slug: string) => Promise<boolean>,
  maxAttempts = 30
): Promise<string> {
  const base = validateTenantSlug(raw);
  const start = firstSlugAttempt(base);
  for (let attempt = start; attempt <= maxAttempts; attempt += 1) {
    const candidate = slugCandidate(base, attempt);
    if (isReservedSlug(candidate)) continue;
    if (!(await isTaken(candidate))) return candidate;
  }
  throw new Error("Não foi possível gerar um endereço único para o site. Tente outro nome.");
}
