export type PlatformRole = "PLATFORM_OWNER" | "PLATFORM_ADMIN" | "USER";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function configuredOwnerEmail(
  env: NodeJS.Dict<string> | NodeJS.ProcessEnv = process.env
): string {
  return normalizeEmail(env.PLATFORM_OWNER_EMAIL ?? "");
}

/**
 * Primeiro usuário da plataforma vira PLATFORM_OWNER.
 * Se PLATFORM_OWNER_EMAIL estiver definido, só esse e-mail é promovido.
 * Depois que um dono existe, ninguém mais sobe de papel pelo cliente.
 */
export function resolveBootstrapRole(input: {
  email: string;
  ownerAlreadyExists: boolean;
  configuredOwnerEmail?: string;
}): PlatformRole {
  if (input.ownerAlreadyExists) return "USER";
  const email = normalizeEmail(input.email);
  if (!email) return "USER";
  const configured = normalizeEmail(input.configuredOwnerEmail ?? "");
  if (configured) return email === configured ? "PLATFORM_OWNER" : "USER";
  return "PLATFORM_OWNER";
}
