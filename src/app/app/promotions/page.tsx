"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenant } from "@/lib/tenant/TenantContext";
import {
  deletePromotion,
  listPromotions,
  upsertPromotion,
  type UpsertPromotionInput,
} from "@/lib/repository/promotions";
import { listServices } from "@/lib/repository/services";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import type { DayOfWeek, Promotion, PromotionType, Service } from "@/types";

type DiscountType = "percent" | "fixed";

const PROMOTION_TYPE_OPTIONS: { id: PromotionType; label: string; hint: string }[] = [
  { id: "first_visit", label: "Primeira visita", hint: "Desconto para clientes sem visitas anteriores." },
  { id: "off_peak", label: "Horários de baixa", hint: "Desconto em dias e faixas de horário específicos." },
  { id: "combo", label: "Combo de serviços", hint: "Desconto ao agendar um conjunto de serviços." },
  { id: "service", label: "Serviço específico", hint: "Desconto em um serviço específico." },
];

const DAYS: { id: DayOfWeek; label: string }[] = [
  { id: 0, label: "Dom" },
  { id: 1, label: "Seg" },
  { id: 2, label: "Ter" },
  { id: 3, label: "Qua" },
  { id: 4, label: "Qui" },
  { id: 5, label: "Sex" },
  { id: 6, label: "Sáb" },
];

function typeLabel(t: PromotionType): string {
  return PROMOTION_TYPE_OPTIONS.find((o) => o.id === t)?.label ?? t;
}

function emptyForm(): UpsertPromotionInput {
  return {
    name: "",
    type: "first_visit",
    discountType: "percent",
    discountValue: 10,
    active: true,
    offPeakDays: [],
  };
}

export default function PromotionsPage() {
  const { activeTenantId } = useTenant();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<UpsertPromotionInput>(emptyForm());
  const [editId, setEditId] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [comboText, setComboText] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("percent");

  const load = useCallback(async () => {
    if (!activeTenantId) return;
    const [promos, svcs] = await Promise.all([
      listPromotions(activeTenantId),
      listServices(activeTenantId, true),
    ]);
    setPromotions(promos);
    setServices(svcs);
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
      await upsertPromotion(activeTenantId, editId, {
        name: form.name,
        type: form.type,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        active: form.active,
        serviceId: form.serviceId || undefined,
        comboServiceIds: form.type === "combo" ? comboText.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
        offPeakDays: form.offPeakDays,
        offPeakStartTime: form.offPeakStartTime || undefined,
        offPeakEndTime: form.offPeakEndTime || undefined,
        validFrom: form.validFrom || undefined,
        validUntil: form.validUntil || undefined,
      });
      setModalOpen(false);
      setForm(emptyForm());
      setEditId(undefined);
      await load();
    } catch (err) {
      setError((err as Error).message ?? "Erro ao salvar a promoção.");
    } finally {
      setSaving(false);
    }
  }

  function openNew() {
    setEditId(undefined);
    setForm(emptyForm());
    setComboText("");
    setModalOpen(true);
  }

  function openEdit(p: Promotion) {
    setEditId(p.id);
    setForm({
      name: p.name,
      type: p.type,
      discountType: p.discountType,
      discountValue: p.discountValue,
      active: p.active,
      serviceId: p.serviceId,
      comboServiceIds: p.comboServiceIds,
      offPeakDays: p.offPeakDays ?? [],
      offPeakStartTime: p.offPeakStartTime,
      offPeakEndTime: p.offPeakEndTime,
      validFrom: p.validFrom,
      validUntil: p.validUntil,
    });
    setComboText((p.comboServiceIds ?? []).join(","));
    setModalOpen(true);
  }

  function toggleDay(day: DayOfWeek) {
    setForm((prev) => ({
      ...prev,
      offPeakDays: prev.offPeakDays?.includes(day)
        ? prev.offPeakDays.filter((d) => d !== day)
        : [...(prev.offPeakDays ?? []), day],
    }));
  }

  if (loading) return <p className="text-slate-500">Carregando...</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Promoções</h1>
          <p className="text-sm text-slate-500">
            Descontos para primeira visita, horários de baixa, combos e serviços.
          </p>
        </div>
        <button onClick={openNew} className="btn-primary">
          Nova promoção
        </button>
      </div>

      {promotions.length === 0 ? (
        <EmptyState
          title="Nenhuma promoção"
          description="Crie promoções para atrair novos clientes e aumentar a ocupação."
          action={
            <button onClick={openNew} className="btn-primary">
              Nova promoção
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {promotions.map((p) => (
            <div key={p.id} className="card">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-slate-900">{p.name}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{typeLabel(p.type)}</div>
                </div>
                <span
                  className={`badge ${p.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}
                >
                  {p.active ? "Ativa" : "Inativa"}
                </span>
              </div>
              <div className="mt-3 text-2xl font-bold text-brand-600">
                {p.discountType === "percent" ? `${p.discountValue}%` : `R$ ${p.discountValue}`}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {p.validFrom || p.validUntil
                  ? `${p.validFrom ?? "…"} até ${p.validUntil ?? "…"}`
                  : "Sem validade"}
              </div>
              <div className="mt-4 flex justify-end gap-3 border-t border-slate-100 pt-3 text-xs">
                <button onClick={() => openEdit(p)} className="text-brand-600 hover:underline">
                  Editar
                </button>
                <button
                  onClick={async () => {
                    if (!activeTenantId) return;
                    if (window.confirm(`Excluir a promoção ${p.name}?`)) {
                      await deletePromotion(activeTenantId, p.id);
                      await load();
                    }
                  }}
                  className="text-red-600 hover:underline"
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? "Editar promoção" : "Nova promoção"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nome *</label>
            <input
              required
              className="input"
              placeholder="Ex.: Primeira visita com 20% off"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Tipo</label>
            <div className="grid gap-2 sm:grid-cols-2">
              {PROMOTION_TYPE_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setForm({ ...form, type: o.id })}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    form.type === o.id
                      ? "border-brand-600 bg-brand-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="text-sm font-semibold text-slate-900">{o.label}</div>
                  <div className="text-xs text-slate-500">{o.hint}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Tipo de desconto</label>
              <select
                className="input"
                value={form.discountType}
                onChange={(e) => setForm({ ...form, discountType: e.target.value as DiscountType })}
              >
                <option value="percent">Percentual (%)</option>
                <option value="fixed">Valor fixo (R$)</option>
              </select>
            </div>
            <div>
              <label className="label">Valor do desconto *</label>
              <input
                required
                type="number"
                min={0}
                className="input"
                value={form.discountValue}
                onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })}
              />
            </div>
          </div>

          {form.type === "service" && (
            <div>
              <label className="label">Serviço *</label>
              <select
                required
                className="input"
                value={form.serviceId ?? ""}
                onChange={(e) => setForm({ ...form, serviceId: e.target.value || undefined })}
              >
                <option value="">Selecione um serviço</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {form.type === "combo" && (
            <div>
              <label className="label">Serviços do combo (IDs separados por vírgula) *</label>
              <div className="mb-1 flex flex-wrap gap-1">
                {services.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() =>
                      setComboText((prev) => {
                        const ids = prev.split(",").map((x) => x.trim()).filter(Boolean);
                        const next = ids.includes(s.id) ? ids.filter((x) => x !== s.id) : [...ids, s.id];
                        return next.join(",");
                      })
                    }
                    className={`badge cursor-pointer px-2 py-0.5 text-xs ${
                      comboText.split(",").map((x) => x.trim()).includes(s.id)
                        ? "bg-brand-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
              <input
                required
                className="input"
                placeholder="Ex.: id1,id2,id3"
                value={comboText}
                onChange={(e) => setComboText(e.target.value)}
              />
            </div>
          )}

          {form.type === "off_peak" && (
            <>
              <div>
                <label className="label">Dias da semana</label>
                <div className="flex flex-wrap gap-1">
                  {DAYS.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => toggleDay(d.id)}
                      className={`badge cursor-pointer px-2 py-1 text-xs ${
                        form.offPeakDays?.includes(d.id)
                          ? "bg-brand-600 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Início (HH:mm)</label>
                  <input
                    type="time"
                    className="input"
                    value={form.offPeakStartTime ?? ""}
                    onChange={(e) => setForm({ ...form, offPeakStartTime: e.target.value || undefined })}
                  />
                </div>
                <div>
                  <label className="label">Fim (HH:mm)</label>
                  <input
                    type="time"
                    className="input"
                    value={form.offPeakEndTime ?? ""}
                    onChange={(e) => setForm({ ...form, offPeakEndTime: e.target.value || undefined })}
                  />
                </div>
              </div>
            </>
          )}

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

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand-600"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Promoção ativa
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Salvando..." : "Salvar promoção"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
