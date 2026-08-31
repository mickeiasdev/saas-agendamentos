import { describe, expect, it } from "vitest";
import { getRoleForTenant, hasAccess } from "./membership";
import { can, roleLevel } from "./roles";
import type { Role, TenantUser } from "@/types";

function membership(tenantId: string, role: Role, status: "active" | "invited" | "disabled" = "active"): TenantUser {
  return {
    userId: "u1",
    tenantId,
    role,
    status,
    createdAt: new Date("2025-01-01"),
  };
}

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

describe("isolamento multi-tenant (Tenant A -> Tenant B)", () => {
  const memberships = [membership(TENANT_A, "TENANT_OWNER")];

  it("usuário do Tenant A NÃO tem associação no Tenant B", () => {
    expect(getRoleForTenant(memberships, TENANT_B)).toBeUndefined();
  });

  it("sem associação no Tenant B, qualquer permissão é NEGADA", () => {
    expect(hasAccess(memberships, TENANT_B, "appointment.create")).toBe(false);
    expect(hasAccess(memberships, TENANT_B, "service.manage")).toBe(false);
    expect(hasAccess(memberships, TENANT_B, "master.view")).toBe(false);
  });

  it("no Tenant A o mesmo usuário tem acesso de acordo com o papel", () => {
    expect(hasAccess(memberships, TENANT_A, "service.manage")).toBe(true);
    expect(hasAccess(memberships, TENANT_A, "settings.manage")).toBe(true);
  });

  it("associação desabilitada/convite pendente não concede acesso", () => {
    const disabled = [membership(TENANT_A, "TENANT_OWNER", "disabled")];
    const invited = [membership(TENANT_A, "TENANT_OWNER", "invited")];
    expect(hasAccess(disabled, TENANT_A, "service.manage")).toBe(false);
    expect(hasAccess(invited, TENANT_A, "service.manage")).toBe(false);
  });

  it("papel de tenant não acessa dados de outro tenant mesmo com papel de plataforma ausente", () => {
    expect(can("TENANT_OWNER", "master.view")).toBe(false);
  });

  it("papel PROFESSIONAL do Tenant A não gerencia dados no Tenant B", () => {
    const proA = [membership(TENANT_A, "PROFESSIONAL")];
    expect(hasAccess(proA, TENANT_A, "customer.view")).toBe(true);
    expect(hasAccess(proA, TENANT_A, "customer.manage")).toBe(false);
    expect(hasAccess(proA, TENANT_B, "customer.view")).toBe(false);
  });
});

describe("hierarquia e permissões relevantes ao isolamento", () => {
  it("TENANT_OWNER não pode acessar o painel master", () => {
    expect(can("TENANT_OWNER", "master.manage")).toBe(false);
    expect(roleLevel("TENANT_OWNER")).toBeLessThan(roleLevel("PLATFORM_ADMIN"));
  });

  it("papel de plataforma acessa o master, mas não é membro de tenant", () => {
    expect(can("PLATFORM_ADMIN", "master.view")).toBe(true);
    expect(getRoleForTenant([], TENANT_A)).toBeUndefined();
  });
});
