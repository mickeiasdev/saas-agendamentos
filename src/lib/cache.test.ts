import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TtlCache } from "./cache";

describe("cache (Fase 3.21)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("armazena e recupera valores antes do TTL", () => {
    const cache = new TtlCache<number>({ ttlMs: 60_000 });
    cache.set("a", 1);
    expect(cache.get("a")).toBe(1);
    expect(cache.has("a")).toBe(true);
  });

  it("expira entradas após o TTL", () => {
    const cache = new TtlCache<number>({ ttlMs: 60_000 });
    cache.set("a", 1);
    vi.advanceTimersByTime(61_000);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.has("a")).toBe(false);
  });

  it("getOrSet computa apenas quando necessário", () => {
    const cache = new TtlCache<number>({ ttlMs: 60_000 });
    const compute = vi.fn(() => 42);
    expect(cache.getOrSet("k", compute)).toBe(42);
    expect(cache.getOrSet("k", compute)).toBe(42);
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it("respeita limite de entradas removendo a mais antiga", () => {
    const cache = new TtlCache<number>({ ttlMs: 60_000, maxEntries: 2 });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    expect(cache.size).toBe(2);
    expect(cache.get("a")).toBeUndefined();
  });

  it("suporta delete e clear", () => {
    const cache = new TtlCache<number>();
    cache.set("a", 1);
    cache.set("b", 2);
    cache.delete("a");
    expect(cache.has("a")).toBe(false);
    cache.clear();
    expect(cache.size).toBe(0);
  });
});
