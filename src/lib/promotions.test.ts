import { describe, expect, it } from "vitest";
import {
  applyBestPromotion,
  discountAmountFor,
  evaluatePromotion,
  type PromotionContext,
} from "./promotions";
import type { Promotion } from "@/types";

function basePromotion(overrides: Partial<Promotion> = {}): Promotion {
  return {
    id: "promo1",
    tenantId: "t1",
    name: "Promo",
    type: "service",
    discountType: "percent",
    discountValue: 10,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const ctx: PromotionContext = {
  serviceId: "s1",
  bookingServiceIds: ["s1"],
  date: "2030-01-14",
  dayOfWeek: 1,
  time: "14:00",
  customerVisitCount: 3,
};

describe("promoções (Fase 2.14)", () => {
  it("aplica promoção de serviço quando o serviço confere", () => {
    const promo = basePromotion({ type: "service", serviceId: "s1" });
    expect(evaluatePromotion(promo, ctx).ok).toBe(true);
    expect(evaluatePromotion(basePromotion({ type: "service", serviceId: "s2" }), ctx).ok).toBe(false);
  });

  it("aplica primeira visita apenas para cliente sem visitas", () => {
    const promo = basePromotion({ type: "first_visit" });
    expect(evaluatePromotion(promo, ctx).ok).toBe(false);
    expect(evaluatePromotion(promo, { ...ctx, customerVisitCount: 0 }).ok).toBe(true);
  });

  it("aplica off-peak conforme dia e horário", () => {
    const promo = basePromotion({
      type: "off_peak",
      offPeakDays: [1, 2, 3],
      offPeakStartTime: "09:00",
      offPeakEndTime: "17:00",
    });
    expect(evaluatePromotion(promo, ctx).ok).toBe(true);
    expect(evaluatePromotion(promo, { ...ctx, time: "19:00" }).ok).toBe(false);
    expect(evaluatePromotion(promo, { ...ctx, dayOfWeek: 6 }).ok).toBe(false);
  });

  it("aplica combo quando todos os serviços estão presentes", () => {
    const promo = basePromotion({ type: "combo", comboServiceIds: ["s1", "s2"] });
    expect(evaluatePromotion(promo, ctx).ok).toBe(false);
    expect(
      evaluatePromotion(promo, { ...ctx, bookingServiceIds: ["s1", "s2"] }).ok
    ).toBe(true);
  });

  it("respeita a validade e o flag ativo", () => {
    expect(evaluatePromotion(basePromotion({ active: false }), ctx).ok).toBe(false);
    expect(
      evaluatePromotion(basePromotion({ type: "service", serviceId: "s1", validUntil: "2020-01-01" }), ctx).ok
    ).toBe(false);
  });

  it("calcula desconto percentual e fixo", () => {
    expect(discountAmountFor(100, "percent", 10)).toBe(10);
    expect(discountAmountFor(100, "fixed", 15)).toBe(15);
    expect(discountAmountFor(100, "fixed", 999)).toBe(100);
  });

  it("escolhe a melhor promoção aplicável", () => {
    const service = basePromotion({ type: "service", serviceId: "s1", discountValue: 5 });
    const offPeak = basePromotion({
      id: "promo2",
      type: "off_peak",
      discountType: "fixed",
      discountValue: 20,
      offPeakDays: [1],
      offPeakStartTime: "09:00",
      offPeakEndTime: "17:00",
    });
    const result = applyBestPromotion([service, offPeak], ctx, 100);
    expect(result.applied?.id).toBe("promo2");
    expect(result.discount).toBe(20);
    expect(result.finalPrice).toBe(80);
  });
});
