"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenant } from "@/lib/tenant/TenantContext";
import {
  createCoupon,
  deleteCoupon,
  listCoupons,
  updateCoupon,
  type CreateCouponInput,
} from "@/lib/repository/coupons";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Coupon } from "@/types";

interface CouponForm extends CreateCouponInput {
  id?: string;
}

const EMPTY_FORM: CouponForm = {
  code: "",
  type: "percent",
  value: 10,
  active: true,
};

export default function CouponsPage() {
  const { activeTenantId } = useTenant();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<CouponForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!activeTenantId) return;
    const list = await listCoupons(activeTenantId);
    setCoupons(list);
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
      const input: CreateCouponInput = {
        code: form.code,
        type: form.type,
        value: Number(form.value),
        minValue: form.minValue ? Number(form.minValue) : undefined,
        validFrom: form.validFrom || undefined,
        validUntil: form.validUntil || undefined,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : undefined,
        active: form.active,
      };
      if (form.id) {
        await updateCoupon(activeTenantId, form.id, input);
      } else {
        await createCoupon(activeTenantId, input);
      }
      setModalOpen(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      setError((err as Error).message ?? "Erro ao salvar o cupom.");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(c: Coupon) {
    setForm({
      id: c.id,
      code: c.code,
      type: c.type,
      value: c.value,
      minValue: c.minValue,
      validFrom: c.validFrom,
      validUntil: c.validUntil,
      usageLimit: c.usageLimit,
      active: c.active,
    });
    setModalOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cupons</h1>
          <p className="text-sm text-slate-500">
            Crie descontos percentuais ou em valor para os agendamentos do site público.
          </p>
        </div>
        <button
          onClick={() => {
            setForm(EMPTY_FORM);
            setModalOpen(true);
          }}
          className="btn-primary"
        >
          Novo cupom
        </button>
      </div>

      {!loading && coupons.length === 0 ? (
        <EmptyState
          title="Nenhum cupom"
          description="Crie um cupom de desconto para incentivar novos clientes."
          action={
            <button
              onClick={() => {
                setForm(EMPTY_FORM);
                setModalOpen(true);
              }}
              className="btn-primary"
            >
              Novo cupom
            </button>
          }
        />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Validade</th>
                <th className="px-4 py-3">Usos</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {coupons.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-900">{c.code}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.type === "percent" ? "Percentual" : "Valor fixo"}
                  </td>
                  <td className="px-4 py-3 text-slate-900">
                    {c.type === "percent" ? `${c.value}%` : `R$ ${c.value}`}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.validFrom || c.validUntil
                      ? `${c.validFrom ?? "…"} até ${c.validUntil ?? "…"}`
                      : "Sem validade"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.usedCount}
                    {c.usageLimit != null ? ` / ${c.usageLimit}` : ""}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${c.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>
                      {c.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(c)} className="mr-3 text-xs text-brand-600 hover:underline">
                      Editar
                    </button>
                    <button
                      onClick={async () => {
                        if (!activeTenantId) return;
                        if (window.confirm(`Excluir o cupom ${c.code}?`)) {
                          await deleteCoupon(activeTenantId, c.id);
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={form.id ? "Editar cupom" : "Novo cupom"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Código *</label>
              <input
                required
                className="input uppercase"
                placeholder="BEMVINDO10"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Tipo</label>
              <select
                className="input"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as "percent" | "fixed" })}
              >
                <option value="percent">Percentual (%)</option>
                <option value="fixed">Valor fixo (R$)</option>
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Valor *</label>
              <input
                required
                type="number"
                min={0}
                className="input"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Valor mínimo da compra</label>
              <input
                type="number"
                min={0}
                className="input"
                placeholder="Opcional"
                value={form.minValue ?? ""}
                onChange={(e) => setForm({ ...form, minValue: e.target.value ? Number(e.target.value) : undefined })}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Válido de</label>
              <input
                type="date"
                className="input"
                value={form.validFrom ?? ""}
                onChange={(e) => setForm({ ...form, validFrom: e.target.value || undefined })}
              />
            </div>
            <div>
              <label className="label">Válido até</label>
              <input
                type="date"
                className="input"
                value={form.validUntil ?? ""}
                onChange={(e) => setForm({ ...form, validUntil: e.target.value || undefined })}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Limite de usos</label>
              <input
                type="number"
                min={1}
                className="input"
                placeholder="Ilimitado"
                value={form.usageLimit ?? ""}
                onChange={(e) => setForm({ ...form, usageLimit: e.target.value ? Number(e.target.value) : undefined })}
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-brand-600"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                Cupom ativo
              </label>
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Salvando..." : "Salvar cupom"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
