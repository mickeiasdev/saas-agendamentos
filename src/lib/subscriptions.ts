import type { SubscriptionStatus } from "@/types";

/**
 * Estados de assinatura da plataforma (Fase 2.4).
 *
 * Estrutura preparada para cobrança futura: TRIAL -> ACTIVE -> (PAST_DUE /
 * SUSPENDED) -> CANCELLED. Como o plano único não possui plano gratuito nem
 * cobrança real no MVP, o tenant começa em ACTIVE e a transição de status
 * fica pronta para quando um gateway adequado for integrado.
 */

export const SUBSCRIPTION_FLOW: Record<
  SubscriptionStatus,
  SubscriptionStatus[]
> = {
  TRIAL: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["PAST_DUE", "CANCELLED"],
  PAST_DUE: ["ACTIVE", "SUSPENDED", "CANCELLED"],
  SUSPENDED: ["ACTIVE", "CANCELLED"],
  CANCELLED: [],
};

export function canTransition(
  from: SubscriptionStatus,
  to: SubscriptionStatus
): boolean {
  return SUBSCRIPTION_FLOW[from]?.includes(to) ?? false;
}

export function isOperational(status: SubscriptionStatus): boolean {
  return status === "ACTIVE" || status === "TRIAL";
}

export function subscriptionStatusLabel(status: SubscriptionStatus): string {
  const labels: Record<SubscriptionStatus, string> = {
    TRIAL: "Período de teste",
    ACTIVE: "Ativa",
    PAST_DUE: "Pagamento pendente",
    SUSPENDED: "Suspensa",
    CANCELLED: "Cancelada",
  };
  return labels[status] ?? status;
}

export function subscriptionStatusTone(status: SubscriptionStatus): string {
  switch (status) {
    case "ACTIVE":
    case "TRIAL":
      return "bg-emerald-100 text-emerald-700";
    case "PAST_DUE":
    case "SUSPENDED":
      return "bg-amber-100 text-amber-700";
    case "CANCELLED":
      return "bg-red-100 text-red-700";
  }
}

export function daysLeftInTrial(now: Date, trialEndsAt?: Date | null): number | null {
  if (!trialEndsAt) return null;
  return Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / 86400000));
}
