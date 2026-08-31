import { describe, expect, it } from "vitest";
import {
  PLAN_ORDER,
  PLANS,
  checkLimit,
  getFeatureFlags,
  getPlan,
  getPlanLimits,
} from "./plans";
import type { PlanId } from "@/types";

describe("planos", () => {
  it("expõe o plano único ALL (sem plano gratuito nem segmentação)", () => {
    expect(PLAN_ORDER).toEqual(["ALL"]);
    expect(Object.keys(PLANS)).toEqual(["ALL"]);
  });

  it("retorna ALL como padrão para planos desconhecidos", () => {
    expect(getPlan("NENHUM" as PlanId).id).toBe("ALL");
  });

  it("o plano único não aplica limites (tudo ilimitado)", () => {
    const limits = getPlanLimits("ALL");
    expect(limits.maxProfessionals).toBe(-1);
    expect(limits.maxCustomers).toBe(-1);
    expect(limits.maxAppointmentsPerMonth).toBe(-1);
    expect(limits.maxStorageGb).toBe(-1);
    expect(limits.maxBranches).toBe(-1);
  });

  it("todas as feature flags estão habilitadas no plano único", () => {
    const flags = getFeatureFlags("ALL");
    expect(flags.payments).toBe(true);
    expect(flags.whatsapp).toBe(true);
    expect(flags.customDomain).toBe(true);
    expect(flags.reports).toBe(true);
    expect(flags.loyalty).toBe(true);
    expect(flags.inventory).toBe(true);
    expect(flags.multiBranch).toBe(true);
    expect(flags.api).toBe(true);
  });
});

describe("checkLimit", () => {
  it("aprova uso abaixo do limite", () => {
    const r = checkLimit(100, 500, "agendamentos mensais");
    expect(r.ok).toBe(true);
    expect(r.current).toBe(100);
    expect(r.max).toBe(500);
  });

  it("recusa uso exatamente no limite", () => {
    const r = checkLimit(500, 500, "agendamentos mensais");
    expect(r.ok).toBe(false);
    expect(r.message).toContain("Limite do plano atingido");
  });

  it("recusa uso acima do limite", () => {
    const r = checkLimit(501, 500, "agendamentos mensais");
    expect(r.ok).toBe(false);
  });

  it("trata limite negativo como ilimitado", () => {
    const r = checkLimit(100000, -1, "profissionais");
    expect(r.ok).toBe(true);
  });
});

describe("PLANS exportado", () => {
  it("todos os planos têm estrutura completa", () => {
    for (const id of PLAN_ORDER) {
      const plan = PLANS[id];
      expect(plan.id).toBe(id);
      expect(plan.name.length).toBeGreaterThan(0);
      expect(plan.limits.maxProfessionals).toBe(-1);
      expect(typeof plan.features.payments).toBe("boolean");
    }
  });
});
