import type { FeatureFlags, PlanId, PlanLimits } from "@/types";

export interface PlanDefinition {
  id: PlanId;
  name: string;
  description: string;
  limits: PlanLimits;
  features: FeatureFlags;
}

/**
 * PLANO ÚNICO da plataforma.
 *
 * O produto inicial tem UM único plano com TODOS os recursos incluídos:
 * não existe plano gratuito nem planos segmentados (FREE/BASIC/PRO/PREMIUM).
 *
 * Limites: nenhum limite é aplicado no produto inicial (valores -1 =
 * ilimitado). A estrutura PlanLimits/checkLimit permanece preparada para
 * uso futuro, mas o plano único não restringe nada.
 *
 * Feature flags: todas habilitadas por padrão. As flags existem para
 * controle de ativação futura (ex.: integrar um gateway de pagamento),
 * não para diferenciar planos.
 */
export const PLAN: PlanDefinition = {
  id: "ALL",
  name: "Completo",
  description: "Plano único com todos os recursos da plataforma incluídos, sem limites.",
  limits: {
    maxProfessionals: -1, // ilimitado
    maxCustomers: -1, // ilimitado
    maxAppointmentsPerMonth: -1, // ilimitado
    maxStorageGb: -1, // ilimitado
    maxBranches: -1, // ilimitado
  },
  features: {
    payments: true,
    whatsapp: true,
    customDomain: true,
    reports: true,
    loyalty: true,
    inventory: true,
    multiBranch: true,
    api: true,
  },
};

export const PLAN_ID: PlanId = "ALL";

export const PLANS: Record<PlanId, PlanDefinition> = {
  ALL: PLAN,
};

export const PLAN_ORDER: PlanId[] = ["ALL"];

export function getPlan(planId: PlanId): PlanDefinition {
  return PLANS[planId] ?? PLAN;
}

export function getPlanLimits(planId: PlanId): PlanLimits {
  return getPlan(planId).limits;
}

export function getFeatureFlags(planId: PlanId): FeatureFlags {
  return getPlan(planId).features;
}

export interface LimitStatus {
  ok: boolean;
  current: number;
  max: number;
  message?: string;
}

export function checkLimit(
  current: number,
  max: number,
  label: string
): LimitStatus {
  if (max < 0) return { ok: true, current, max };
  if (current >= max) {
    return {
      ok: false,
      current,
      max,
      message: `Limite do plano atingido: ${label} (${current}/${max}). Faça upgrade do plano para continuar.`,
    };
  }
  return { ok: true, current, max };
}
