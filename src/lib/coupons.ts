import type { Coupon } from "@/types";

export interface CouponValidationResult {
  ok: boolean;
  reason?: string;
  discountedPrice?: number;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function dateKey(now: Date): string {
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
}

/**
 * Valida um cupom e calcula o preço com desconto.
 * Regras: ativo, validade, limite de uso e valor mínimo.
 */
export function applyCoupon(opts: {
  coupon: Coupon | null;
  basePrice: number;
  now?: Date;
}): CouponValidationResult {
  const { coupon, basePrice, now = new Date() } = opts;

  if (!coupon) return { ok: false, reason: "Cupom não encontrado." };
  if (!coupon.active) return { ok: false, reason: "Cupom inativo." };

  const today = dateKey(now);
  if (coupon.validFrom && today < coupon.validFrom) {
    return { ok: false, reason: "Este cupom ainda não é válido." };
  }
  if (coupon.validUntil && today > coupon.validUntil) {
    return { ok: false, reason: "Este cupom expirou." };
  }
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    return { ok: false, reason: "Este cupom esgotou a quantidade de usos." };
  }
  if (coupon.minValue != null && basePrice < coupon.minValue) {
    return {
      ok: false,
      reason: `Valor mínimo de ${coupon.minValue} para usar este cupom.`,
    };
  }

  let price = basePrice;
  if (coupon.type === "percent") {
    price = Math.max(0, Math.round((basePrice * (100 - coupon.value)) / 100));
  } else {
    price = Math.max(0, basePrice - coupon.value);
  }

  return { ok: true, discountedPrice: price };
}
