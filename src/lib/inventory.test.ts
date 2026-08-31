import { describe, expect, it } from "vitest";
import {
  applyStockMovement,
  balanceFromMovements,
  isLowStock,
  isMovementValid,
  lowStockProducts,
  movementsWithDelta,
  stockValueAtCost,
} from "./inventory";
import type { Product, StockMovement } from "@/types";

function makeProduct(overrides: Partial<Product> = {}): Product {
  const now = new Date();
  return {
    id: "p1",
    tenantId: "tenant-a",
    name: "Shampoo",
    costPrice: 10,
    salePrice: 25,
    quantity: 50,
    minQuantity: 5,
    active: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeMovement(overrides: Partial<StockMovement> = {}): StockMovement {
  const now = new Date();
  return {
    id: "m1",
    tenantId: "tenant-a",
    productId: "p1",
    productName: "Shampoo",
    type: "in",
    quantity: 10,
    createdAt: now,
    ...overrides,
  };
}

describe("inventory (Fase 3.10)", () => {
  it("valida movimentações", () => {
    expect(isMovementValid({ type: "in", quantity: 5, productName: "X" })).toBe(true);
    expect(isMovementValid({ type: "out", quantity: 5, productName: "X" })).toBe(true);
    expect(isMovementValid({ type: "adjustment", quantity: 5, productName: "X" })).toBe(true);
    expect(isMovementValid({ type: "in", quantity: 0, productName: "X" })).toBe(false);
    expect(isMovementValid({ type: "in", quantity: -2, productName: "X" })).toBe(false);
    expect(isMovementValid({ type: "in", quantity: 5, productName: " " })).toBe(false);
  });

  it("aplica entrada, saída e ajuste", () => {
    expect(applyStockMovement(50, { type: "in", quantity: 10 })).toEqual({ ok: true, quantity: 60 });
    expect(applyStockMovement(50, { type: "out", quantity: 10 })).toEqual({ ok: true, quantity: 40 });
    expect(applyStockMovement(50, { type: "adjustment", quantity: 30 })).toEqual({ ok: true, quantity: 30 });
  });

  it("bloqueia saída maior que o saldo", () => {
    const result = applyStockMovement(5, { type: "out", quantity: 10 });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Estoque insuficiente");
  });

  it("identifica estoque baixo", () => {
    expect(isLowStock({ quantity: 5, minQuantity: 5 })).toBe(true);
    expect(isLowStock({ quantity: 6, minQuantity: 5 })).toBe(false);
    expect(lowStockProducts([makeProduct({ quantity: 5 }), makeProduct({ quantity: 100 })])).toHaveLength(1);
    expect(lowStockProducts([makeProduct({ quantity: 2, active: false })])).toHaveLength(0);
  });

  it("calcula valor do estoque a custo", () => {
    expect(stockValueAtCost([makeProduct({ quantity: 10, costPrice: 5 }), makeProduct({ quantity: 2, costPrice: 20 })])).toBe(90);
  });

  it("calcula delta e reconstrói saldo por movimentações", () => {
    const movements = [
      makeMovement({ type: "in", quantity: 10 }),
      makeMovement({ type: "out", quantity: 4 }),
      makeMovement({ type: "in", quantity: 6 }),
    ];
    const deltas = movementsWithDelta(movements);
    expect(deltas.map((d) => d.delta)).toEqual([10, -4, 6]);
    expect(balanceFromMovements(movements)).toBe(12);
  });
});
