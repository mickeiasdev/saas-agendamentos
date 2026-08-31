import { describe, expect, it } from "vitest";
import {
  consumeSubscriptionUse,
  cycleDurationDays,
  deriveSubscriptionStatus,
  isPlanValid,
  isSubscriptionUsable,
  renewSubscription,
} from "./customerSubscriptions";
import type { CustomerSubscription } from "@/types";

function makeSub(overrides: Partial<CustomerSubscription> = {}): CustomerSubscription {
  const now = new Date("2026-01-10T12:00:00Z");
  return {
    id: "sub-1",
    tenantId: "tenant-a",
    planId: "plan-1",
    planName: "Plano Mensal",
    customerId: "cust-1",
    customerName: "Maria",
    price: 99,
    appointmentsIncluded: 4,
    appointmentsUsed: 1,
    cycleStart: now,
    cycleEnd: new Date("2026-02-09T12:00:00Z"),
    status: "active",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("customer subscriptions (Fase 3.9)", () => {
  it("valida plano", () => {
    expect(isPlanValid({ name: "Mensal", price: 99, appointmentsIncluded: 4, billingCycle: "monthly" })).toBe(true);
    expect(isPlanValid({ name: "M", price: 99, appointmentsIncluded: 4, billingCycle: "monthly" })).toBe(false);
    expect(isPlanValid({ name: "Mensal", price: -1, appointmentsIncluded: 4, billingCycle: "monthly" })).toBe(false);
    expect(isPlanValid({ name: "Mensal", price: 99, appointmentsIncluded: -1, billingCycle: "monthly" })).toBe(false);
    expect(isPlanValid({ name: "Mensal", price: 99, appointmentsIncluded: 4, billingCycle: "weekly" })).toBe(true);
  });

  it("duração dos ciclos", () => {
    expect(cycleDurationDays("weekly")).toBe(7);
    expect(cycleDurationDays("monthly")).toBe(30);
    expect(cycleDurationDays("quarterly")).toBe(90);
    expect(cycleDurationDays("yearly")).toBe(365);
  });

  it("verifica se é utilizável dentro do período", () => {
    const sub = makeSub();
    expect(isSubscriptionUsable(sub, new Date("2026-02-01T12:00:00Z"))).toBe(true);
    expect(isSubscriptionUsable(sub, new Date("2026-03-01T12:00:00Z"))).toBe(false);
    expect(isSubscriptionUsable(makeSub({ status: "paused" }), new Date("2026-02-01T12:00:00Z"))).toBe(false);
  });

  it("consome um atendimento incluso", () => {
    const sub = makeSub();
    const result = consumeSubscriptionUse(sub, new Date("2026-02-01T12:00:00Z"));
    expect(result.ok).toBe(true);
    expect(result.subscription?.appointmentsUsed).toBe(2);
    expect(result.remaining).toBe(2);
  });

  it("bloqueia uso fora do ciclo e sem saldo", () => {
    const expired = makeSub({ status: "active" });
    expect(consumeSubscriptionUse(expired, new Date("2026-03-01T12:00:00Z")).ok).toBe(false);

    const full = makeSub({ appointmentsUsed: 4 });
    expect(consumeSubscriptionUse(full, new Date("2026-02-01T12:00:00Z")).ok).toBe(false);
  });

  it("renova a assinatura para o próximo ciclo", () => {
    const sub = makeSub();
    const renewed = renewSubscription(sub, new Date("2026-02-09T12:00:00Z"));
    expect(renewed.appointmentsUsed).toBe(0);
    expect(renewed.status).toBe("active");
    expect(renewed.cycleStart.getTime()).toBe(new Date("2026-02-09T12:00:00Z").getTime());
    expect(renewed.cycleEnd.getTime()).toBe(new Date("2026-03-11T12:00:00Z").getTime());
  });

  it("reinicia ciclo atrasado a partir de agora", () => {
    const sub = makeSub();
    const renewed = renewSubscription(sub, new Date("2026-02-20T12:00:00Z"));
    expect(renewed.cycleStart.getTime()).toBe(new Date("2026-02-20T12:00:00Z").getTime());
  });

  it("deriva status para expirado após o fim do ciclo", () => {
    const sub = makeSub();
    expect(deriveSubscriptionStatus(sub, new Date("2026-02-01T12:00:00Z"))).toBe("active");
    expect(deriveSubscriptionStatus(sub, new Date("2026-03-01T12:00:00Z"))).toBe("expired");
    expect(deriveSubscriptionStatus(makeSub({ status: "cancelled" }), new Date("2026-02-01T12:00:00Z"))).toBe("cancelled");
  });
});
