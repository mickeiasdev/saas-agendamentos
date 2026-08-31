import type { LoyaltyAccount } from "@/types";

/**
 * Fidelidade (Fase 2.15).
 *
 * Regras: 1 ponto por real gasto (configurável via ratio). Pontos podem ser
 * acumulados e resgatados por recompensas; nunca é possível resgatar mais
 * pontos do que o saldo disponível.
 */

export const DEFAULT_POINTS_PER_REAL = 1;

export function pointsForAmount(amount: number, ratio: number = DEFAULT_POINTS_PER_REAL): number {
  return Math.max(0, Math.floor(amount * ratio));
}

export interface EarnResult {
  ok: boolean;
  pointsEarned: number;
  newBalance: number;
}

export function earnPoints(account: LoyaltyAccount, amount: number, ratio?: number): EarnResult {
  const pointsEarned = pointsForAmount(amount, ratio);
  return {
    ok: true,
    pointsEarned,
    newBalance: account.points + pointsEarned,
  };
}

export interface RedeemResult {
  ok: boolean;
  reason?: string;
  newBalance?: number;
}

export function redeemPoints(account: LoyaltyAccount, pointsCost: number): RedeemResult {
  if (pointsCost <= 0) return { ok: false, reason: "Custo de recompensa inválido." };
  if (account.points < pointsCost) {
    return { ok: false, reason: "Saldo de pontos insuficiente para esta recompensa." };
  }
  return { ok: true, newBalance: account.points - pointsCost };
}

export function loyaltyTier(points: number): { name: string; min: number } {
  const tiers = [
    { name: "Bronze", min: 0 },
    { name: "Prata", min: 500 },
    { name: "Ouro", min: 1500 },
  ];
  return tiers.reduce(
    (acc, t) => (points >= t.min ? t : acc),
    tiers[0]
  );
}
