import type { FinancialCategory, FinancialEntry, FinancialEntryType } from "@/types";

/**
 * Financeiro (Fase 2.18).
 *
 * Entradas: agendamentos, produtos, pacotes.
 * Saídas: despesas, fornecedores, funcionários.
 */

export interface CategoryMeta {
  id: FinancialCategory;
  type: FinancialEntryType;
  label: string;
}

export const FINANCIAL_CATEGORIES: CategoryMeta[] = [
  { id: "appointments", type: "income", label: "Agendamentos" },
  { id: "products", type: "income", label: "Produtos" },
  { id: "packages", type: "income", label: "Pacotes" },
  { id: "other_income", type: "income", label: "Outras entradas" },
  { id: "expenses", type: "expense", label: "Despesas" },
  { id: "suppliers", type: "expense", label: "Fornecedores" },
  { id: "salaries", type: "expense", label: "Funcionários" },
  { id: "other_expense", type: "expense", label: "Outras saídas" },
];

export function categoryMeta(category: FinancialCategory): CategoryMeta {
  return (
    FINANCIAL_CATEGORIES.find((c) => c.id === category) ?? {
      id: category,
      type: "income",
      label: category,
    }
  );
}

export function categoriesOfType(type: FinancialEntryType): CategoryMeta[] {
  return FINANCIAL_CATEGORIES.filter((c) => c.type === type);
}

export interface FinancialSummary {
  income: number;
  expense: number;
  balance: number;
}

export function financialSummary(entries: FinancialEntry[]): FinancialSummary {
  return entries.reduce<FinancialSummary>(
    (acc, e) => {
      const amount = e.amount ?? 0;
      if (e.type === "income") {
        acc.income += amount;
      } else {
        acc.expense += amount;
      }
      acc.balance = acc.income - acc.expense;
      return acc;
    },
    { income: 0, expense: 0, balance: 0 }
  );
}
