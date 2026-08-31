import type { Product, Sale, SaleItem } from "@/types";

/**
 * Vendas (Fase 3.11).
 *
 * Lógica pura de vendas: totais, desconto, validação de estoque e baixa de
 * estoque integrada. A venda origina uma entrada financeira (ver financial.ts)
 * e movimentações de estoque (ver inventory.ts).
 */

export function computeSubtotal(items: SaleItem[]): number {
  return items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
}

export interface SaleTotals {
  subtotal: number;
  discount: number;
  total: number;
}

/** Calcula subtotal, desconto (nunca maior que o subtotal) e total. */
export function computeSaleTotals(items: SaleItem[], discount = 0): SaleTotals {
  const subtotal = computeSubtotal(items);
  const safeDiscount = Math.max(0, Math.min(discount, subtotal));
  return { subtotal, discount: safeDiscount, total: subtotal - safeDiscount };
}

export function validateSaleItems(items: SaleItem[]): { ok: boolean; error?: string } {
  if (items.length === 0) return { ok: false, error: "A venda deve conter ao menos um item." };
  for (const item of items) {
    if (!item.productName?.trim()) return { ok: false, error: "Item sem nome de produto." };
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      return { ok: false, error: "Quantidade inválida." };
    }
    if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) {
      return { ok: false, error: "Preço unitário inválido." };
    }
  }
  return { ok: true };
}

export interface SaleStockCheck {
  ok: boolean;
  error?: string;
  /** Quantidades efetivamente disponíveis por produto, após validação. */
}

/** Valida se há estoque suficiente para todos os itens da venda. */
export function validateSaleStock(
  products: Pick<Product, "id" | "quantity">[],
  items: SaleItem[]
): SaleStockCheck {
  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    if (!product) {
      return { ok: false, error: `Produto "${item.productName}" não encontrado.` };
    }
    if (item.quantity > product.quantity) {
      return {
        ok: false,
        error: `Estoque insuficiente de "${item.productName}" (disponível: ${product.quantity}).`,
      };
    }
  }
  return { ok: true };
}

export interface SaleDeduction {
  productId: string;
  productName: string;
  quantity: number;
}

/** Deduções de estoque necessárias para a venda (uma por item). */
export function saleDeductions(items: SaleItem[]): SaleDeduction[] {
  return items.map((i) => ({
    productId: i.productId,
    productName: i.productName,
    quantity: i.quantity,
  }));
}

/** Valor total do custo dos itens (para margem de lucro). */
export function computeSaleCost(
  products: Pick<Product, "id" | "costPrice">[],
  items: SaleItem[]
): number {
  return items.reduce((sum, i) => {
    const p = products.find((x) => x.id === i.productId);
    return sum + (p?.costPrice ?? 0) * i.quantity;
  }, 0);
}

/** Constrói a entrada financeira de receita a partir da venda concluída. */
export function saleToFinancialEntry(sale: Sale): {
  type: "income";
  category: "products";
  description: string;
  amount: number;
  date: string;
  sourceId: string;
  sourceType: "product";
} {
  const date = sale.createdAt instanceof Date ? sale.createdAt.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  return {
    type: "income",
    category: "products",
    description: `Venda ${sale.id}${sale.customerName ? ` — ${sale.customerName}` : ""}`,
    amount: sale.total,
    date,
    sourceId: sale.id,
    sourceType: "product",
  };
}
