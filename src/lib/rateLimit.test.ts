import { describe, expect, it } from "vitest";
import { evaluateRateLimit, makeRateWindow } from "./rateLimit";

describe("rateLimit (Fase 3.18)", () => {
  it("permite requisições dentro do limite", () => {
    const window = makeRateWindow("k");
    const result = evaluateRateLimit(window, { windowMs: 60_000, max: 3 }, 1000);
    expect(result.allowed).toBe(true);
    expect(result.current).toBe(1);
    expect(result.remaining).toBe(2);
  });

  it("bloqueia quando atinge o máximo e informa retryAfter", () => {
    let window = makeRateWindow("k");
    const config = { windowMs: 60_000, max: 3 };
    window = evaluateRateLimit(window, config, 1000).nextWindow;
    window = evaluateRateLimit(window, config, 1100).nextWindow;
    window = evaluateRateLimit(window, config, 1200).nextWindow;

    const blocked = evaluateRateLimit(window, config, 1300);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBe(59_700);
  });

  it("purga hits antigos fora da janela", () => {
    const config = { windowMs: 60_000, max: 3 };
    let window = makeRateWindow("k");
    window = evaluateRateLimit(window, config, 1000).nextWindow;
    window = evaluateRateLimit(window, config, 1100).nextWindow;
    // 61s depois: o hit em t=1000 sai da janela (<= cutoff), o de t=1100 permanece.
    const result = evaluateRateLimit(window, config, 61_000);
    expect(result.allowed).toBe(true);
    expect(result.current).toBe(2);
    expect(result.remaining).toBe(1);
  });
});
