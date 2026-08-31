import { describe, expect, it } from "vitest";
import {
  DEFAULT_POINTS_PER_REAL,
  earnPoints,
  loyaltyTier,
  pointsForAmount,
  redeemPoints,
} from "./loyalty";
import type { LoyaltyAccount } from "@/types";

function account(points: number): LoyaltyAccount {
  return {
    id: "acc1",
    tenantId: "t1",
    customerId: "c1",
    customerName: "João",
    points,
    pointsEarned: points,
    pointsSpent: 0,
    updatedAt: new Date(),
  };
}

describe("fidelidade (Fase 2.15)", () => {
  it("converte reais em pontos (1 ponto por real, arredondado para baixo)", () => {
    expect(pointsForAmount(100)).toBe(100);
    expect(pointsForAmount(49.9)).toBe(49);
    expect(pointsForAmount(0)).toBe(0);
    expect(pointsForAmount(-10)).toBe(0);
    expect(DEFAULT_POINTS_PER_REAL).toBe(1);
  });

  it("acumula pontos no saldo", () => {
    const result = earnPoints(account(50), 150);
    expect(result.ok).toBe(true);
    expect(result.pointsEarned).toBe(150);
    expect(result.newBalance).toBe(200);
  });

  it("resgata pontos quando há saldo suficiente", () => {
    const result = redeemPoints(account(200), 120);
    expect(result.ok).toBe(true);
    expect(result.newBalance).toBe(80);
  });

  it("bloqueia resgate sem saldo suficiente", () => {
    const result = redeemPoints(account(100), 120);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("insuficiente");
  });

  it("bloqueia custo de recompensa inválido", () => {
    expect(redeemPoints(account(100), 0).ok).toBe(false);
    expect(redeemPoints(account(100), -5).ok).toBe(false);
  });

  it("define o tier com base no saldo", () => {
    expect(loyaltyTier(0).name).toBe("Bronze");
    expect(loyaltyTier(600).name).toBe("Prata");
    expect(loyaltyTier(2000).name).toBe("Ouro");
  });
});
