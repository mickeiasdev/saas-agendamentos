import type { TenantUser } from "@/types";

export function getRoleForTenant(
  memberships: TenantUser[] | undefined,
  tenantId: string
): TenantUser | undefined {
  return memberships?.find((m) => m.tenantId === tenantId);
}
