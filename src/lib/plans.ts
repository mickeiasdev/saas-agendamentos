import type { FeatureFlags, PlanId, PlanLimits } from "@/types";

export interface PlanDefinition {
  id: PlanId;
  name: string;
  description: string;
  limits: PlanLimits;
  features: FeatureFlags;
}

/**
 * Planos da plataforma (Fase 2).
 * Os limites daqui são aplicados no backend (API de booking) e exibidos no painel.
 * Nomes podem ser alterados comercialmente; os IDs são estáveis.
 */
export const PLANS: Record<PlanId, PlanDefinition> = {
  FREE: {
    id: "FREE",
    name: "Grátis",
    description: "Para começar: até 3 profissionais e 500 agendamentos/mês.",
    limits: {
      maxProfessionals: 3,
      maxCustomers: 200,
      maxAppointmentsPerMonth: 500,
      maxStorageGb: 1,
      maxBranches: 1,
    },
    features: {
      payments: false,
      whatsapp: false,
      customDomain: false,
      reports: false,
      loyalty: false,
      inventory: false,
      multiBranch: false,
      api: false,
    },
  },
  BASIC: {
    id: "BASIC",
    name: "Básico",
    description: "Para negócios em crescimento: até 8 profissionais.",
    limits: {
      maxProfessionals: 8,
      maxCustomers: 2000,
      maxAppointmentsPerMonth: 3000,
      maxStorageGb: 5,
      maxBranches: 1,
    },
    features: {
      payments: true,
      whatsapp: false,
      customDomain: false,
      reports: false,
      loyalty: false,
      inventory: false,
      multiBranch: false,
      api: false,
    },
  },
  PRO: {
    id: "PRO",
    name: "Profissional",
    description: "Para operação completa: relatórios, cupons e WhatsApp.",
    limits: {
      maxProfessionals: 25,
      maxCustomers: 10000,
      maxAppointmentsPerMonth: 15000,
      maxStorageGb: 20,
      maxBranches: 3,
    },
    features: {
      payments: true,
      whatsapp: true,
      customDomain: true,
      reports: true,
      loyalty: true,
      inventory: false,
      multiBranch: true,
      api: false,
    },
  },
  PREMIUM: {
    id: "PREMIUM",
    name: "Premium",
    description: "Escala máxima: unidades, estoque, API e prioridade total.",
    limits: {
      maxProfessionals: 100,
      maxCustomers: 100000,
      maxAppointmentsPerMonth: 100000,
      maxStorageGb: 100,
      maxBranches: 10,
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
  },
};

export const PLAN_ORDER: PlanId[] = ["FREE", "BASIC", "PRO", "PREMIUM"];

export function getPlan(planId: PlanId): PlanDefinition {
  return PLANS[planId] ?? PLANS.FREE;
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
