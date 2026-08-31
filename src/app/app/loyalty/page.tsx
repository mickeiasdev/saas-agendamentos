"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenant } from "@/lib/tenant/TenantContext";
import {
  deleteLoyaltyReward,
  listLoyaltyAccounts,
  listLoyaltyRewards,
  listLoyaltyTransactions,
  upsertLoyaltyReward,
  type UpsertRewardInput,
} from "@/lib/repository/loyalty";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/utils/format";
import { loyaltyTier } from "@/lib/loyalty";
import type { LoyaltyAccount, LoyaltyReward, LoyaltyTransaction } from "@/types";

type Tab = "accounts" | "rewards" | "history";

const EMPTY_FORM: UpsertRewardInput = {
  name: "",
  description: "",
  pointsCost: 100,
  active: true,
};

export default function LoyaltyPage() {
  const { activeTenantId } = useTenant();
  const [tab, setTab] = useState<Tab>("accounts");
  const [accounts, setAccounts] = useState<LoyaltyAccount[]>([]);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<UpsertRewardInput>(EMPTY_FORM);
  const [editId, setEditId] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!activeTenantId) return;
    const [accs, rws, txs] = await Promise.all([
      listLoyaltyAccounts(activeTenantId),
      listLoyaltyRewards(activeTenantId),
      listLoyaltyTransactions(activeTenantId),
    ]);
    setAccounts(accs);
    setRewards(rws);
    setTransactions(txs);
    setLoading(false);
  }, [activeTenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTenantId) return;
    setError("");
    setSaving(true);
    try {
      await upsertLoyaltyReward(activeTenantId, editId, {
        name: form.name,
        description: form.description || undefined,
        pointsCost: Number(form.pointsCost),
        active: form.active,
      });
      setModalOpen(false);
      setForm(EMPTY_FORM);
      setEditId(undefined);
      await load();
    } catch (err) {
      setError((err as Error).message ?? "Erro ao salvar a recompensa.");
    } finally {
      setSaving(false);
    }
  }

  function openNewReward() {
    setEditId(undefined);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEditReward(r: LoyaltyReward) {
    setEditId(r.id);
    setForm({
      name: r.name,
      description: r.description ?? "",
      pointsCost: r.pointsCost,
      active: r.active,
    });
    setModalOpen(true);
  }

  const accountName = (customerId: string) =>
    accounts.find((a) => a.customerId === customerId)?.customerName ?? customerId.slice(0, 8);

  if (loading) return <p className="text-slate-500">Carregando...</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Fidelidade</h1>
          <p className="text-sm text-slate-500">
            Pontos, recompensas e histórico dos seus clientes.
          </p>
        </div>
        {tab === "rewards" && (
          <button onClick={openNewReward} className="btn-primary">
            Nova recompensa
          </button>
        )}
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        {(
          [
            { id: "accounts", label: "Contas de clientes" },
            { id: "rewards", label: "Recompensas" },
            { id: "history", label: "Histórico" },
          ] as { id: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "accounts" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.length === 0 ? (
            <EmptyState
              title="Nenhuma conta de fidelidade"
              description="Os clientes ganham pontos automaticamente ao serem atendidos."
            />
          ) : (
            accounts.map((a) => (
              <div key={a.id} className="card">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-900">{a.customerName}</div>
                  <span className="badge bg-amber-100 text-amber-700">
                    {loyaltyTier(a.points).name}
                  </span>
                </div>
                <div className="mt-2 text-3xl font-bold text-brand-600">{a.points}</div>
                <div className="text-sm text-slate-500">pontos disponíveis</div>
                <div className="mt-3 flex justify-between text-xs text-slate-400">
                  <span>Acumulados: {a.pointsEarned}</span>
                  <span>Resgatados: {a.pointsSpent}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "rewards" && (
        <>
          {rewards.length === 0 ? (
            <EmptyState
              title="Nenhuma recompensa"
              description="Crie recompensas que seus clientes podem resgatar com pontos."
              action={
                <button onClick={openNewReward} className="btn-primary">
                  Nova recompensa
                </button>
              }
            />
          ) : (
            <div className="card overflow-x-auto p-0">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Recompensa</th>
                    <th className="px-4 py-3">Descrição</th>
                    <th className="px-4 py-3">Custo (pontos)</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rewards.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-900">{r.name}</td>
                      <td className="px-4 py-3 text-slate-600">{r.description ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-900">{r.pointsCost}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`badge ${r.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}
                        >
                          {r.active ? "Ativa" : "Inativa"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => openEditReward(r)} className="mr-3 text-xs text-brand-600 hover:underline">
                          Editar
                        </button>
                        <button
                          onClick={async () => {
                            if (!activeTenantId) return;
                            if (window.confirm(`Excluir a recompensa ${r.name}?`)) {
                              await deleteLoyaltyReward(activeTenantId, r.id);
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
        </>
      )}

      {tab === "history" && (
        <>
          {transactions.length === 0 ? (
            <EmptyState
              title="Nenhuma transação"
              description="O histórico de pontos aparecerá conforme os clientes ganham e resgatam pontos."
            />
          ) : (
            <div className="card overflow-x-auto p-0">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Descrição</th>
                    <th className="px-4 py-3 text-right">Pontos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-600">{formatDateTime(t.createdAt)}</td>
                      <td className="px-4 py-3 text-slate-900">{accountName(t.customerId)}</td>
                      <td className="px-4 py-3 text-slate-600">{t.description}</td>
                      <td
                        className={`px-4 py-3 text-right font-semibold ${
                          t.type === "earn" ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {t.type === "earn" ? "+" : "-"}
                        {t.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? "Editar recompensa" : "Nova recompensa"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nome *</label>
            <input
              required
              className="input"
              placeholder="Ex.: Desconto de R$ 20"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Descrição</label>
            <textarea
              className="input"
              rows={2}
              placeholder="Opcional"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Custo em pontos *</label>
            <input
              required
              type="number"
              min={1}
              className="input"
              value={form.pointsCost}
              onChange={(e) => setForm({ ...form, pointsCost: Number(e.target.value) })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand-600"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Recompensa ativa
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Salvando..." : "Salvar recompensa"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
