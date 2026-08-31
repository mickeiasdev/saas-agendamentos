import { describe, expect, it } from "vitest";
import {
  FINANCIAL_CATEGORIES,
  categoriesOfType,
  categoryMeta,
  financialSummary,
} from "./financial";
import type { FinancialEntry } from "@/types";

describe("financeiro (Fase 2.18)", () => {
  it("agrupa entradas e saídas por categoria", () => {
    expect(categoriesOfType("income").map((c) => c.id)).toEqual([
      "appointments",
      "products",
      "packages",
      "other_income",
    ]);
    expect(categoriesOfType("expense").map((c) => c.id)).toEqual([
      "expenses",
      "suppliers",
      "salaries",
      "other_expense",
    ]);
    expect(FINANCIAL_CATEGORIES.length).toBe(8);
  });

  it("retorna metadados de categoria", () => {
    expect(categoryMeta("appointments").label).toBe("Agendamentos");
    expect(categoryMeta("suppliers").type).toBe("expense");
  });

  it("calcula o resumo de entradas e saídas", () => {
    const entries: FinancialEntry[] = [
      { id: "1", tenantId: "t1", type: "income", category: "appointments", description: "Corte", amount: 100, date: "2030-01-01", createdAt: new Date() },
      { id: "2", tenantId: "t1", type: "income", category: "products", description: "Shampoo", amount: 50, date: "2030-01-02", createdAt: new Date() },
      { id: "3", tenantId: "t1", type: "expense", category: "suppliers", description: "Produtos", amount: 30, date: "2030-01-03", createdAt: new Date() },
    ];
    const summary = financialSummary(entries);
    expect(summary.income).toBe(150);
    expect(summary.expense).toBe(30);
    expect(summary.balance).toBe(120);
  });

  it("resumo vazio é zerado", () => {
    const summary = financialSummary([]);
    expect(summary).toEqual({ income: 0, expense: 0, balance: 0 });
  });
});
