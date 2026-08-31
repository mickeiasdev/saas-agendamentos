/**
 * Cache (Fase 3.21).
 *
 * Cache em memória com TTL e limite de entradas. O objetivo é reduzir leituras
 * no Firestore (menor consumo do free tier). Implementação pura, síncrona e
 * testável; pode ser substituída por Redis/Cloud Cache no futuro sem mudar a
 * interface usada pelos repositórios.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class TtlCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(opts: { ttlMs?: number; maxEntries?: number } = {}) {
    this.ttlMs = opts.ttlMs ?? 60_000;
    this.maxEntries = opts.maxEntries ?? 500;
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  set(key: string, value: T, ttlMs?: number): void {
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      this.evictExpired();
      if (this.store.size >= this.maxEntries) {
        const oldestKey = this.store.keys().next().value;
        if (oldestKey !== undefined) this.store.delete(oldestKey);
      }
    }
    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.ttlMs),
    });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    this.evictExpired();
    return this.store.size;
  }

  /** Remove entradas expiradas. */
  evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
  }

  /** Lê do cache ou computa e armazena o resultado. */
  getOrSet(key: string, compute: () => T, ttlMs?: number): T {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const value = compute();
    this.set(key, value, ttlMs);
    return value;
  }
}

export function makeCache<T>(opts?: { ttlMs?: number; maxEntries?: number }): TtlCache<T> {
  return new TtlCache<T>(opts);
}
