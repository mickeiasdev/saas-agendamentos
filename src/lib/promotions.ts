import type { Promotion } from "@/types";

/**
 * Promoções (Fase 2.14).
 *
 * Regras disponíveis:
 *  - primeira visita (cliente sem visitas anteriores);
 *  - horários (janela de horário/dia da semana, ex.: horário comercial);
 *  - combos (conjunto de serviços agendados juntos);
 *  - serviços (desconto em um serviço específico).
 */

export interface PromotionContext {
  serviceId?: string;
  bookingServiceIds: string[];
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 0-6
  time: string; // "HH:mm"
  customerVisitCount: number;
}

export interface PromotionEvaluation {
  ok: boolean;
  reason?: string;
  discountValue?: number;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function isWithinValidity(promotion: Promotion, date: string): boolean {
  if (promotion.validFrom && date < promotion.validFrom) return false;
  if (promotion.validUntil && date > promotion.validUntil) return false;
  return true;
}

export function evaluatePromotion(
  promotion: Promotion,
  ctx: PromotionContext
): PromotionEvaluation {
  if (!promotion.active) return { ok: false, reason: "Promoção inativa." };
  if (!isWithinValidity(promotion, ctx.date)) return { ok: false, reason: "Promoção fora do período de validade." };

  switch (promotion.type) {
    case "first_visit": {
      if (ctx.customerVisitCount !== 0) {
        return { ok: false, reason: "Aplicável apenas à primeira visita." };
      }
      break;
    }
    case "service": {
      if (!promotion.serviceId || promotion.serviceId !== ctx.serviceId) {
        return { ok: false, reason: "Não se aplica a este serviço." };
      }
      break;
    }
    case "combo": {
      const combo = promotion.comboServiceIds ?? [];
      if (combo.length === 0) return { ok: false, reason: "Combo sem serviços configurados." };
      const missing = combo.filter((id) => !ctx.bookingServiceIds.includes(id));
      if (missing.length > 0) {
        return { ok: false, reason: "O combo exige serviços adicionais." };
      }
      break;
    }
    case "off_peak": {
      const days = promotion.offPeakDays ?? [];
      if (days.length > 0 && !days.includes(ctx.dayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6)) {
        return { ok: false, reason: "Fora dos dias promocionais." };
      }
      if (promotion.offPeakStartTime && promotion.offPeakEndTime) {
        const t = timeToMinutes(ctx.time);
        const start = timeToMinutes(promotion.offPeakStartTime);
        const end = timeToMinutes(promotion.offPeakEndTime);
        if (t < start || t >= end) {
          return { ok: false, reason: "Fora da faixa de horário promocional." };
        }
      }
      break;
    }
  }

  return { ok: true, discountValue: promotion.discountValue };
}

export function discountAmountFor(
  basePrice: number,
  discountType: Promotion["discountType"],
  discountValue: number
): number {
  if (discountType === "percent") {
    return Math.round((basePrice * discountValue) / 100);
  }
  return Math.min(basePrice, discountValue);
}

export function applyBestPromotion(
  promotions: Promotion[],
  ctx: PromotionContext,
  basePrice: number
): { applied: Promotion | null; discount: number; finalPrice: number } {
  let best: Promotion | null = null;
  let bestDiscount = 0;

  for (const promotion of promotions) {
    const result = evaluatePromotion(promotion, ctx);
    if (!result.ok || result.discountValue === undefined) continue;
    const discount = discountAmountFor(basePrice, promotion.discountType, result.discountValue);
    if (discount > bestDiscount) {
      bestDiscount = discount;
      best = promotion;
    }
  }

  return {
    applied: best,
    discount: bestDiscount,
    finalPrice: Math.max(0, basePrice - bestDiscount),
  };
}
