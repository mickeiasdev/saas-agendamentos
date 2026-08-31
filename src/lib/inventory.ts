import type { Product, StockMovement } from "@/types";

/**
 * Estoque (Fase 3.10).
 *
 * Lógica pura de estoque: movimentações de entrada/saída/ajuste, cálculo de
 * saldo, alertas de estoque mínimo e validações. O saldo é sempre derivado da
 * quantidade atual do produto, atualizada por movimentações validadas.
 */

export interface ApplyMovementResult {
  ok: boolean;
  quantity?: number;
  error?: string;
}

export function isMovementValid(input: {
  type: StockMovement["type"];
  quantity: number;
  productName?: string;
}): boolean {
  if (!input.productName?.trim()) return false;
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) return false;
  return ["in", "out", "adjustment"].includes(input.type);
}

/**
 * Aplica uma movimentação ao estoque atual do produto. Saídas não podem
 * deixar o saldo negativo. Ajuste define o saldo absoluto.
 */
export function applyStockMovement(
  currentQuantity: number,
  input: {
    type: StockMovement["type"];
    quantity: number;
  }
): ApplyMovementResult {
  switch (input.type) {
    case "in":
      return { ok: true, quantity: currentQuantity + input.quantity };
    case "out": {
      if (input.quantity > currentQuantity) {
        return { ok: false, error: "Estoque insuficiente para esta saída." };
      }
      return { ok: true, quantity: currentQuantity - input.quantity };
    }
    case "adjustment":
      if (input.quantity < 0) {
        return { ok: false, error: "Ajuste deve ser um valor não negativo." };
      }
      return { ok: true, quantity: input.quantity };
    default:
      return { ok: false, error: "Tipo de movimentação inválido." };
  }
}

export function isLowStock(product: Pick<Product, "quantity" | "minQuantity">): boolean {
  return product.quantity <= product.minQuantity;
}

export function lowStockProducts(products: Product[]): Product[] {
  return products.filter((p) => p.active && isLowStock(p));
}

/** Valor do estoque a custo (soma de quantidade * custo). */
export function stockValueAtCost(products: Product[]): number {
  return products.reduce((sum, p) => sum + p.quantity * p.costPrice, 0);
}

export interface StockMovementWithDelta extends StockMovement {
  /** Variação de saldo causada por esta movimentação (positivo/negativo). */
  delta: number;
}

/** Calcula o delta de saldo de cada movimentação. */
export function movementsWithDelta(movements: StockMovement[]): StockMovementWithDelta[] {
  return movements.map((m) => ({
    ...m,
    delta:
      m.type === "in" ? m.quantity : m.type === "out" ? -m.quantity : 0,
  }));
}

/** Reconstitui o saldo de um produto a partir das movimentações históricas. */
export function balanceFromMovements(movements: StockMovement[]): number {
  let balance = 0;
  for (const m of movements) {
    if (m.type === "in") balance += m.quantity;
    else if (m.type === "out") balance -= m.quantity;
  }
  return balance;
}
