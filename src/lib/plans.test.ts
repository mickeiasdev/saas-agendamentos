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
  it("expõe os quatro planos na ordem FREE -> PREMIUM", () => {
    expect(PLAN_ORDER).toEqual(["FREE", "BASIC", "PRO", "PREMIUM"]);
  });

  it("retorna FREE como padrão para planos desconhecidos", () => {
    expect(getPlan("NENHUM" as PlanId).id).toBe("FREE");
  });

  it("FREE tem os menores limites", () => {
    const limits = getPlanLimits("FREE");
    expect(limits.maxProfessionals).toBe(3);
    expect(limits.maxCustomers).toBe(200);
    expect(limits.maxAppointmentsPerMonth).toBe(500);
    expect(limits.maxBranches).toBe(1);
  });

  it("PREMIUM tem os maiores limites", () => {
    const limits = getPlanLimits("PREMIUM");
    expect(limits.maxProfessionals).toBe(100);
    expect(limits.maxAppointmentsPerMonth).toBe(100000);
    expect(limits.maxBranches).toBe(10);
  });

  it("limites crescem de forma não decrescente entre planos", () => {
    const keys = ["maxProfessionals", "maxCustomers", "maxAppointmentsPerMonth", "maxStorageGb", "maxBranches"] as const;
    for (const key of keys) {
      for (let i = 1; i < PLAN_ORDER.length; i++) {
        const prev = getPlanLimits(PLAN_ORDER[i - 1])[key];
        const cur = getPlanLimits(PLAN_ORDER[i])[key];
        expect(cur, `${key} deve crescer de ${PLAN_ORDER[i - 1]} para ${PLAN_ORDER[i]}`).toBeGreaterThanOrEqual(prev);
      }
    }
  });

  it("feature flags ativam conforme o plano (payments, whatsapp, reports)", () => {
    expect(getFeatureFlags("FREE").payments).toBe(false);
    expect(getFeatureFlags("BASIC").payments).toBe(true);
    expect(getFeatureFlags("BASIC").whatsapp).toBe(false);
    expect(getFeatureFlags("PRO").whatsapp).toBe(true);
    expect(getFeatureFlags("PRO").reports).toBe(true);
    expect(getFeatureFlags("PREMIUM").inventory).toBe(true);
    expect(getFeatureFlags("PREMIUM").api).toBe(true);
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
      expect(plan.limits.maxProfessionals).toBeGreaterThan(0);
      expect(typeof plan.features.payments).toBe("boolean");
    }
  });
});
