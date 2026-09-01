import type { BillingCycle, CustomerSubscription, CustomerSubscriptionPlan, TimestampLike } from "@/types";

/**
 * Assinaturas dos clientes (Fase 3.9).
 *
 * As empresas vendem seus próprios planos aos clientes (ex.: "Plano mensal,
 * 4 atendimentos, R$99"). Lógica pura de ciclos de cobrança, uso e
 * renovação de assinatura.
 */

export function isPlanValid(plan: Pick<CustomerSubscriptionPlan, "name" | "price" | "appointmentsIncluded" | "billingCycle">): boolean {
  return (
    plan.name.trim().length >= 2 &&
    Number.isFinite(plan.price) &&
    plan.price >= 0 &&
    Number.isInteger(plan.appointmentsIncluded) &&
    plan.appointmentsIncluded >= 0 &&
    ["weekly", "monthly", "quarterly", "yearly"].includes(plan.billingCycle)
  );
}

/** Dias de duração de um ciclo de cobrança. */
export function cycleDurationDays(cycle: BillingCycle): number {
  switch (cycle) {
    case "weekly":
      return 7;
    case "monthly":
      return 30;
    case "quarterly":
      return 90;
    case "yearly":
      return 365;
  }
}

export interface SubscriptionUseResult {
  ok: boolean;
  subscription?: CustomerSubscription;
  error?: string;
  remaining?: number;
}

/** Checa se a assinatura está ativa e dentro do período do ciclo. */
export function isSubscriptionUsable(
  sub: Pick<CustomerSubscription, "status" | "cycleEnd">,
  now: Date
): boolean {
  if (sub.status !== "active") return false;
  const end = sub.cycleEnd instanceof Date ? sub.cycleEnd : sub.cycleEnd?.toDate?.() ?? new Date(String(sub.cycleEnd));
  return now.getTime() <= end.getTime();
}

/** Utiliza um atendimento incluso na assinatura. */
export function consumeSubscriptionUse(
  sub: CustomerSubscription,
  now: Date
): SubscriptionUseResult {
  if (!isSubscriptionUsable(sub, now)) {
    return {
      ok: false,
      error: sub.status !== "active" ? "Assinatura não está ativa." : "Assinatura fora do período vigente.",
    };
  }
  if (sub.appointmentsUsed >= sub.appointmentsIncluded) {
    return { ok: false, error: "Você já utilizou todos os atendimentos inclusos deste ciclo." };
  }
  const updated = {
    ...sub,
    appointmentsUsed: sub.appointmentsUsed + 1,
  };
  return { ok: true, subscription: updated, remaining: sub.appointmentsIncluded - sub.appointmentsUsed - 1 };
}

/** Renova a assinatura para um novo ciclo a partir de `from`. Se `now` já
 * ultrapassou o fim do ciclo anterior, o novo ciclo começa agora.
 */
export function renewSubscription(
  sub: CustomerSubscription,
  from: Date
): CustomerSubscription {
  const base = from.getTime() > toMs(sub.cycleEnd) ? from : toDate(sub.cycleEnd);
  const durationMs = cycleDurationDays(sub.billingCycle) * 86400000;
  const start = new Date(base.getTime());
  const end = new Date(base.getTime() + durationMs);
  return {
    ...sub,
    appointmentsUsed: 0,
    cycleStart: start,
    cycleEnd: end,
    status: "active",
  };
}

function toMs(v: TimestampLike): number {
  if (v instanceof Date) return v.getTime();
  if (v && typeof v === "object" && typeof (v as { toDate?: unknown }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate().getTime();
  }
  return new Date(String(v)).getTime();
}

function toDate(v: TimestampLike): Date {
  return new Date(toMs(v));
}

/** Deriva o status da assinatura: expira se o ciclo terminou e não foi renovado. */
export function deriveSubscriptionStatus(
  sub: CustomerSubscription,
  now: Date
): CustomerSubscription["status"] {
  if (sub.status !== "active") return sub.status;
  if (now.getTime() > toMs(sub.cycleEnd)) return "expired";
  return "active";
}
