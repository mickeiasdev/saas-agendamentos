import { describe, expect, it } from "vitest";
import { can, isAtLeast, roleLevel } from "./roles";
import type { Role } from "@/types";

const ROLES: Role[] = [
  "PLATFORM_OWNER",
  "PLATFORM_ADMIN",
  "TENANT_OWNER",
  "TENANT_ADMIN",
  "MANAGER",
  "PROFESSIONAL",
  "CUSTOMER",
];

describe("roleLevel", () => {
  it("tem hierarquia estritamente decrescente", () => {
    const levels = ROLES.map(roleLevel);
    for (let i = 0; i < levels.length - 1; i++) {
      expect(levels[i]).toBeGreaterThan(levels[i + 1]);
    }
  });
});

describe("isAtLeast", () => {
  it("TENANT_ADMIN está acima de MANAGER e abaixo de TENANT_OWNER", () => {
    expect(isAtLeast("TENANT_ADMIN", "MANAGER")).toBe(true);
    expect(isAtLeast("TENANT_ADMIN", "TENANT_OWNER")).toBe(false);
    expect(isAtLeast("TENANT_ADMIN", "TENANT_ADMIN")).toBe(true);
  });
});

describe("can", () => {
  it("CUSTOMER pode criar agendamento, mas não gerenciar serviços", () => {
    expect(can("CUSTOMER", "appointment.create")).toBe(true);
    expect(can("CUSTOMER", "service.manage")).toBe(false);
  });

  it("MANAGER pode gerenciar clientes, agendamentos, serviços e horários", () => {
    expect(can("MANAGER", "customer.manage")).toBe(true);
    expect(can("MANAGER", "appointment.manage")).toBe(true);
    expect(can("MANAGER", "service.manage")).toBe(true);
    expect(can("MANAGER", "category.manage")).toBe(true);
    expect(can("MANAGER", "professional.manage")).toBe(true);
    expect(can("MANAGER", "availability.manage")).toBe(true);
  });

  it("PROFESSIONAL pode ver clientes mas não gerenciá-los", () => {
    expect(can("PROFESSIONAL", "customer.view")).toBe(true);
    expect(can("PROFESSIONAL", "customer.manage")).toBe(false);
  });

  it("TENANT_OWNER acessa tudo do tenant", () => {
    expect(can("TENANT_OWNER", "settings.manage")).toBe(true);
    expect(can("TENANT_OWNER", "availability.manage")).toBe(true);
    expect(can("TENANT_OWNER", "team.manage")).toBe(true);
  });

  it("TENANT_ADMIN convida equipe e personaliza o tenant; MANAGER não", () => {
    expect(can("TENANT_ADMIN", "team.manage")).toBe(true);
    expect(can("TENANT_ADMIN", "settings.manage")).toBe(true);
    expect(can("MANAGER", "team.manage")).toBe(false);
    expect(can("MANAGER", "settings.manage")).toBe(false);
  });

  it("TENANT_ADMIN gerencia cupons, promoções, fidelidade e financeiro", () => {
    expect(can("TENANT_ADMIN", "coupon.manage")).toBe(true);
    expect(can("TENANT_ADMIN", "promotion.manage")).toBe(true);
    expect(can("TENANT_ADMIN", "loyalty.manage")).toBe(true);
    expect(can("TENANT_ADMIN", "financial.manage")).toBe(true);
  });

  it("MANAGER não gerencia financeiro, promoções ou fidelidade", () => {
    expect(can("MANAGER", "financial.manage")).toBe(false);
    expect(can("MANAGER", "promotion.manage")).toBe(false);
    expect(can("MANAGER", "loyalty.manage")).toBe(false);
  });

  it("papéis de plataforma têm acesso amplo, exceto master.manage", () => {
    expect(can("PLATFORM_ADMIN", "master.view")).toBe(true);
    expect(can("PLATFORM_ADMIN", "master.manage")).toBe(false);
    expect(can("PLATFORM_OWNER", "master.manage")).toBe(true);
    expect(can("PLATFORM_OWNER", "service.manage")).toBe(true);
  });

  it("papéis de tenant não acessam o painel master", () => {
    expect(can("TENANT_OWNER", "master.view")).toBe(false);
  });

  it("role indefinido não tem permissões", () => {
    expect(can(undefined, "appointment.create")).toBe(false);
  });
});
