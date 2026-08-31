"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTenant } from "@/lib/tenant/TenantContext";
import {
  deleteFinancialEntry,
  listFinancialEntries,
  upsertFinancialEntry,
  type CreateFinancialEntryInput,
} from "@/lib/repository/financial";
import {
  categoriesOfType,
  categoryMeta,
  financialSummary,
} from "@/lib/financial";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatBRL, toDate } from "@/lib/utils/format";
import type { FinancialCategory, FinancialEntry, FinancialEntryType } from "@/types";

const dateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const EMPTY_FORM: CreateFinancialEntryInput = {
  type: "income",
  category: "appointments",
  description: "",
  amount: 0,
  date: dateKey(new Date()),
};

export default function FinancialPage() {
  const { activeTenantId } = useTenant();
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<CreateFinancialEntryInput>(EMPTY_FORM);
  const [editId, setEditId] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [typeFilter, setTypeFilter] = useState<FinancialEntryType | "all">("all");

  const load = useCallback(async () => {
    if (!activeTenantId) return;
    const list = await listFinancialEntries(activeTenantId);
    setEntries(list);
    setLoading(false);
  }, [activeTenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => financialSummary(entries), [entries]);

  const visible = useMemo(
    () => (typeFilter === "all" ? entries : entries.filter((e) => e.type === typeFilter)),
    [entries, typeFilter]
  );

  function setFormType(type: FinancialEntryType) {
    setForm({ ...form, type, category: categoriesOfType(type)[0]?.id ?? form.category });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTenantId) return;
    setError("");
    setSaving(true);
    try {
      await upsertFinancialEntry(activeTenantId, editId, {
        type: form.type,
        category: form.category,
        description: form.description,
        amount: Number(form.amount),
        date: form.date,
      });
      setModalOpen(false);
      setForm(EMPTY_FORM);
      setEditId(undefined);
      await load();
    } catch (err) {
      setError((err as Error).message ?? "Erro ao salvar o lançamento.");
    } finally {
      setSaving(false);
    }
  }

  function openNew(type: FinancialEntryType = "income") {
    setEditId(undefined);
    setForm({ ...EMPTY_FORM, type, category: categoriesOfType(type)[0]?.id ?? "appointments" });
    setModalOpen(true);
  }

  function openEdit(e: FinancialEntry) {
    setEditId(e.id);
    setForm({
      type: e.type,
      category: e.category,
      description: e.description,
      amount: e.amount,
      date: e.date,
    });
    setModalOpen(true);
  }

  if (loading) return <p className="text-slate-500">Carregando...</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Financeiro</h1>
          <p className="text-sm text-slate-500">Entradas, saídas e resumo financeiro da empresa.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => openNew("income")} className="btn-primary">
            Nova entrada
          </button>
          <button onClick={() => openNew("expense")} className="btn-secondary">
            Nova saída
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card">
          <div className="text-3xl font-bold text-green-600">{formatBRL(summary.income)}</div>
          <div className="text-sm text-slate-500">Entradas</div>
        </div>
        <div className="card">
          <div className="text-3xl font-bold text-red-600">{formatBRL(summary.expense)}</div>
          <div className="text-sm text-slate-500">Saídas</div>
        </div>
        <div className="card">
          <div className={`text-3xl font-bold ${summary.balance >= 0 ? "text-slate-900" : "text-red-600"}`}>
            {formatBRL(summary.balance)}
          </div>
          <div className="text-sm text-slate-500">Saldo</div>
        </div>
      </div>

      <div className="flex gap-2">
        {(
          [
            { id: "all", label: "Todas" },
            { id: "income", label: "Entradas" },
            { id: "expense", label: "Saídas" },
          ] as { id: FinancialEntryType | "all"; label: string }[]
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTypeFilter(t.id)}
            className={`badge cursor-pointer px-3 py-1 text-xs ${
              typeFilter === t.id ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="Nenhum lançamento"
          description="Registre entradas (agendamentos, produtos, pacotes) e saídas (despesas, fornecedores, funcionários)."
        />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">{toDate(e.date).toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-3 text-slate-900">{categoryMeta(e.category).label}</td>
                  <td className="px-4 py-3 text-slate-600">{e.description}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`badge ${e.type === "income" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                    >
                      {e.type === "income" ? "Entrada" : "Saída"}
                    </span>
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-semibold ${
                      e.type === "income" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {e.type === "income" ? "+" : "-"}
                    {formatBRL(e.amount)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(e)} className="mr-3 text-xs text-brand-600 hover:underline">
                      Editar
                    </button>
                    <button
                      onClick={async () => {
                        if (!activeTenantId) return;
                        if (window.confirm("Excluir este lançamento?")) {
                          await deleteFinancialEntry(activeTenantId, e.id);
                          await load();
                        }
                      }}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? "Editar lançamento" : "Novo lançamento"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Tipo</label>
              <select
                className="input"
                value={form.type}
                onChange={(e) => setFormType(e.target.value as FinancialEntryType)}
              >
                <option value="income">Entrada</option>
                <option value="expense">Saída</option>
              </select>
            </div>
            <div>
              <label className="label">Categoria</label>
              <select
                className="input"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as FinancialCategory })}
              >
                {categoriesOfType(form.type).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Descrição *</label>
            <input
              required
              className="input"
              placeholder="Ex.: Corte de cabelo"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Valor (R$) *</label>
              <input
                required
                type="number"
                min={0}
                step={0.01}
                className="input"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Data *</label>
              <input
                required
                type="date"
                className="input"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Salvando..." : "Salvar lançamento"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
