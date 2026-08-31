import { describe, expect, it } from "vitest";
import {
  computeSaleCost,
  computeSaleTotals,
  computeSubtotal,
  saleDeductions,
  saleToFinancialEntry,
  validateSaleItems,
  validateSaleStock,
} from "./sales";
import type { Product, Sale, SaleItem } from "@/types";

function makeSale(overrides: Partial<Sale> = {}): Sale {
  const now = new Date("2026-01-10T12:00:00Z");
  return {
    id: "sale-1",
    tenantId: "tenant-a",
    items: [
      { productId: "p1", productName: "Shampoo", quantity: 2, unitPrice: 25 },
      { productId: "p2", productName: "Condicionador", quantity: 1, unitPrice: 30 },
    ],
    total: 80,
    discount: 0,
    customerId: "cust-1",
    customerName: "Maria",
    paymentMethod: "pix",
    status: "completed",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("sales (Fase 3.11)", () => {
  it("calcula subtotal e totais com desconto limitado", () => {
    const items: SaleItem[] = [
      { productId: "p1", productName: "A", quantity: 2, unitPrice: 25 },
      { productId: "p2", productName: "B", quantity: 1, unitPrice: 30 },
    ];
    expect(computeSubtotal(items)).toBe(80);
    expect(computeSaleTotals(items, 10)).toEqual({ subtotal: 80, discount: 10, total: 70 });
    expect(computeSaleTotals(items, 200)).toEqual({ subtotal: 80, discount: 80, total: 0 });
    expect(computeSaleTotals(items, -5)).toEqual({ subtotal: 80, discount: 0, total: 80 });
  });

  it("valida itens da venda", () => {
    expect(validateSaleItems(makeSale().items).ok).toBe(true);
    expect(validateSaleItems([]).ok).toBe(false);
    expect(validateSaleItems([{ productId: "p", productName: "", quantity: 1, unitPrice: 1 }]).ok).toBe(false);
    expect(validateSaleItems([{ productId: "p", productName: "A", quantity: 0, unitPrice: 1 }]).ok).toBe(false);
    expect(validateSaleItems([{ productId: "p", productName: "A", quantity: 1, unitPrice: -1 }]).ok).toBe(false);
  });

  it("valida estoque suficiente", () => {
    const products: Pick<Product, "id" | "quantity">[] = [
      { id: "p1", quantity: 5 },
      { id: "p2", quantity: 1 },
    ];
    expect(validateSaleStock(products, makeSale().items).ok).toBe(true);

    const result = validateSaleStock([{ id: "p1", quantity: 1 }, { id: "p2", quantity: 1 }], makeSale().items);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Estoque insuficiente");

    const missing = validateSaleStock([{ id: "p1", quantity: 10 }], makeSale().items);
    expect(missing.ok).toBe(false);
    expect(missing.error).toContain("não encontrado");
  });

  it("gera deduções de estoque e custo", () => {
    const items: SaleItem[] = [
      { productId: "p1", productName: "A", quantity: 2, unitPrice: 25 },
      { productId: "p2", productName: "B", quantity: 1, unitPrice: 30 },
    ];
    expect(saleDeductions(items)).toEqual([
      { productId: "p1", productName: "A", quantity: 2 },
      { productId: "p2", productName: "B", quantity: 1 },
    ]);
    expect(computeSaleCost([{ id: "p1", costPrice: 10 }, { id: "p2", costPrice: 20 }], items)).toBe(40);
  });

  it("converte venda em entrada financeira", () => {
    const sale = makeSale();
    const entry = saleToFinancialEntry(sale);
    expect(entry).toMatchObject({
      type: "income",
      category: "products",
      amount: 80,
      sourceId: "sale-1",
      sourceType: "product",
    });
    expect(entry.description).toContain("Maria");
    expect(entry.date).toBe("2026-01-10");
  });
});
