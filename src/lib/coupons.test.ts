import { describe, expect, it } from "vitest";
import { applyCoupon } from "./coupons";
import type { Coupon } from "@/types";

function makeCoupon(overrides: Partial<Coupon> = {}): Coupon {
  return {
    id: "c1",
    tenantId: "t1",
    code: "PROMO",
    type: "percent",
    value: 10,
    active: true,
    usedCount: 0,
    ...overrides,
  };
}

describe("applyCoupon", () => {
  const now = new Date("2026-01-15T12:00:00Z");

  it("aplica desconto percentual", () => {
    const result = applyCoupon({ coupon: makeCoupon({ type: "percent", value: 10 }), basePrice: 100, now });
    expect(result).toEqual({ ok: true, discountedPrice: 90 });
  });

  it("aplica desconto em valor fixo", () => {
    const result = applyCoupon({ coupon: makeCoupon({ type: "fixed", value: 20 }), basePrice: 100, now });
    expect(result).toEqual({ ok: true, discountedPrice: 80 });
  });

  it("arredonda o resultado percentual para inteiro", () => {
    const result = applyCoupon({ coupon: makeCoupon({ type: "percent", value: 33 }), basePrice: 100, now });
    expect(result).toEqual({ ok: true, discountedPrice: 67 });
  });

  it("não deixa o preço ficar negativo", () => {
    const percent = applyCoupon({ coupon: makeCoupon({ type: "percent", value: 150 }), basePrice: 100, now });
    expect(percent.ok && percent.discountedPrice).toBe(0);

    const fixed = applyCoupon({ coupon: makeCoupon({ type: "fixed", value: 999 }), basePrice: 100, now });
    expect(fixed.ok && fixed.discountedPrice).toBe(0);
  });

  it("rejeita cupom nulo", () => {
    const result = applyCoupon({ coupon: null, basePrice: 100, now });
    expect(result).toEqual({ ok: false, reason: "Cupom não encontrado." });
  });

  it("rejeita cupom inativo", () => {
    const result = applyCoupon({ coupon: makeCoupon({ active: false }), basePrice: 100, now });
    expect(result).toEqual({ ok: false, reason: "Cupom inativo." });
  });

  it("rejeita cupom antes da validade", () => {
    const result = applyCoupon({
      coupon: makeCoupon({ validFrom: "2026-02-01" }),
      basePrice: 100,
      now,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("ainda não é válido");
  });

  it("rejeita cupom expirado", () => {
    const result = applyCoupon({
      coupon: makeCoupon({ validUntil: "2026-01-01" }),
      basePrice: 100,
      now,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("expirou");
  });

  it("aceita cupom dentro do período de validade (bordas)", () => {
    const start = applyCoupon({ coupon: makeCoupon({ validFrom: "2026-01-15" }), basePrice: 100, now });
    expect(start.ok).toBe(true);

    const end = applyCoupon({ coupon: makeCoupon({ validUntil: "2026-01-15" }), basePrice: 100, now });
    expect(end.ok).toBe(true);
  });

  it("rejeita cupom com limite de uso esgotado", () => {
    const result = applyCoupon({
      coupon: makeCoupon({ usageLimit: 5, usedCount: 5 }),
      basePrice: 100,
      now,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("esgotou");
  });

  it("permite usar enquanto houver limite disponível", () => {
    const result = applyCoupon({
      coupon: makeCoupon({ usageLimit: 5, usedCount: 4 }),
      basePrice: 100,
      now,
    });
    expect(result.ok).toBe(true);
  });

  it("rejeita pedido abaixo do valor mínimo", () => {
    const result = applyCoupon({ coupon: makeCoupon({ minValue: 150 }), basePrice: 100, now });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("Valor mínimo de 150");
  });

  it("aceita pedido igual ou acima do valor mínimo", () => {
    const equal = applyCoupon({ coupon: makeCoupon({ minValue: 100 }), basePrice: 100, now });
    expect(equal.ok).toBe(true);

    const above = applyCoupon({ coupon: makeCoupon({ minValue: 90 }), basePrice: 100, now });
    expect(above.ok).toBe(true);
  });
});
