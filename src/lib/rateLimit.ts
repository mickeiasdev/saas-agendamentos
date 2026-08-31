/**
 * Rate limiting (Fase 3.18).
 *
 * Lógica pura de limitação de taxa por janela fixa deslizante. A persistência
 * dos contadores (ex.: em memória, Firestore ou Redis) fica a cargo do
 * chamador; aqui definimos a avaliação determinística da janela.
 */

export interface RateWindow {
  key: string;
  /** Timestamps (ms) das requisições dentro da janela. */
  hits: number[];
}

export interface RateLimitConfig {
  windowMs: number;
  max: number;
}

export interface RateLimitResult {
  allowed: boolean;
  current: number;
  remaining: number;
  retryAfterMs: number;
  /** Janela atualizada (hits + nova chamada, já limpos). */
  nextWindow: RateWindow;
}

/**
 * Avalia se a chamada pode prosseguir. Purga hits fora da janela, conta o
 * novo hit e retorna o estado atualizado para persistência.
 */
export function evaluateRateLimit(
  window: RateWindow,
  config: RateLimitConfig,
  now: number
): RateLimitResult {
  const cutoff = now - config.windowMs;
  const fresh = window.hits.filter((t) => t > cutoff);
  const nextWindow = { key: window.key, hits: [...fresh, now] };
  const current = fresh.length;

  if (current >= config.max) {
    const oldest = fresh.length > 0 ? Math.min(...fresh) : now;
    const retryAfterMs = Math.max(0, oldest + config.windowMs - now);
    return {
      allowed: false,
      current,
      remaining: 0,
      retryAfterMs,
      nextWindow: { ...nextWindow, hits: fresh },
    };
  }

  return {
    allowed: true,
    current: current + 1,
    remaining: config.max - current - 1,
    retryAfterMs: 0,
    nextWindow,
  };
}

export function makeRateWindow(key: string): RateWindow {
  return { key, hits: [] };
}

export const DEFAULT_API_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60_000,
  max: 60,
};
