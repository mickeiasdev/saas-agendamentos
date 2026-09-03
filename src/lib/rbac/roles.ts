import type { Role } from "@/types";

export const ROLE_NAMES: Record<Role, string> = {
  PLATFORM_OWNER: "Proprietário da Plataforma",
  PLATFORM_ADMIN: "Administrador da Plataforma",
  TENANT_OWNER: "Dono da Empresa",
  TENANT_ADMIN: "Administrador da Empresa",
  MANAGER: "Gerente",
  PROFESSIONAL: "Profissional",
  CUSTOMER: "Cliente",
};

const ROLE_HIERARCHY: Record<Role, number> = {
  PLATFORM_OWNER: 100,
  PLATFORM_ADMIN: 90,
  TENANT_OWNER: 80,
  TENANT_ADMIN: 70,
  MANAGER: 60,
  PROFESSIONAL: 50,
  CUSTOMER: 10,
};

export function roleLevel(role: Role): number {
  return ROLE_HIERARCHY[role];
}

export function isPlatformRole(role: Role): boolean {
  return role === "PLATFORM_OWNER" || role === "PLATFORM_ADMIN";
}

export function isTenantRole(role: Role): boolean {
  return !isPlatformRole(role);
}

export function isAtLeast(role: Role, minimum: Role): boolean {
  return roleLevel(role) >= roleLevel(minimum);
}

export const TENANT_INVITE_ROLES = ["TENANT_ADMIN", "MANAGER", "PROFESSIONAL", "CUSTOMER"] as const;
export type TenantInviteRole = (typeof TENANT_INVITE_ROLES)[number];

export function isTenantInviteRole(role: string): role is TenantInviteRole {
  return (TENANT_INVITE_ROLES as readonly string[]).includes(role);
}

export type Permission =
  | "tenant.manage"
  | "tenant.view"
  | "team.manage"
  | "service.manage"
  | "category.manage"
  | "professional.manage"
  | "availability.manage"
  | "appointment.manage"
  | "appointment.create"
  | "customer.manage"
  | "customer.view"
  | "settings.manage"
  | "reports.view"
  | "coupon.manage"
  | "promotion.manage"
  | "loyalty.manage"
  | "financial.manage"
  | "review.manage"
  | "notification.view"
  | "master.view"
  | "master.manage";

const MIN_ROLE: Record<Permission, Role> = {
  "tenant.manage": "TENANT_OWNER",
  "tenant.view": "PROFESSIONAL",
  "team.manage": "TENANT_ADMIN",
  "service.manage": "TENANT_OWNER",
  "category.manage": "TENANT_OWNER",
  "professional.manage": "TENANT_OWNER",
  "availability.manage": "TENANT_OWNER",
  "appointment.manage": "MANAGER",
  "appointment.create": "CUSTOMER",
  "customer.manage": "MANAGER",
  "customer.view": "PROFESSIONAL",
  "settings.manage": "TENANT_OWNER",
  "reports.view": "TENANT_ADMIN",
  "coupon.manage": "TENANT_ADMIN",
  "promotion.manage": "TENANT_ADMIN",
  "loyalty.manage": "TENANT_ADMIN",
  "financial.manage": "TENANT_ADMIN",
  "review.manage": "TENANT_ADMIN",
  "notification.view": "PROFESSIONAL",
  "master.view": "PLATFORM_ADMIN",
  "master.manage": "PLATFORM_OWNER",
};

export function can(role: Role | undefined, permission: Permission): boolean {
  if (!role) return false;
  if (isPlatformRole(role)) {
    if (permission.startsWith("master.")) {
      return permission === "master.view"
        ? roleLevel(role) >= roleLevel("PLATFORM_ADMIN")
        : role === "PLATFORM_OWNER";
    }
    return true;
  }
  if (permission.startsWith("master.")) return false;
  return roleLevel(role) >= roleLevel(MIN_ROLE[permission]);
}
