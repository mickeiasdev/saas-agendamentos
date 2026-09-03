import { can, type Permission } from "./roles";
import type { Role, TenantUser } from "@/types";

export function getRoleForTenant(
  memberships: TenantUser[] | undefined,
  tenantId: string
): TenantUser | undefined {
  return memberships?.find((m) => m.tenantId === tenantId);
}

/**
 * Autorização de acesso a um tenant específico (espelho do que as Firestore
 * Rules aplicam no backend).
 *
 * Um usuário só pode executar `permission` dentro de `tenantId` se:
 *  - tiver uma associação ativa naquele tenant (não em outro), e
 *  - o papel da associação conceder a permissão.
 *
 * Isso é o coração do isolamento multi-tenant: ter acesso ao Tenant A
 * NÃO concede acesso ao Tenant B.
 */
export function hasAccess(
  memberships: TenantUser[] | undefined,
  tenantId: string,
  permission: Permission,
  platformRole?: Role
): boolean {
  if (permission.startsWith("master.")) return can(platformRole, permission);
  const member = getRoleForTenant(memberships, tenantId);
  if (!member || member.status !== "active") return false;
  return can(member.role, permission);
}
