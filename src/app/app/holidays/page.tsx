"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenant } from "@/lib/tenant/TenantContext";
import {
  createHoliday,
  deleteHoliday,
  listHolidays,
  updateHoliday,
} from "@/lib/repository/holidays";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Holiday } from "@/types";

const BRAZILIAN_HOLIDAYS: { date: string; name: string }[] = [
  { date: "01-01", name: "Confraternização Universal" },
  { date: "04-21", name: "Tiradentes" },
  { date: "05-01", name: "Dia do Trabalho" },
  { date: "09-07", name: "Independência do Brasil" },
  { date: "10-12", name: "Nossa Senhora Aparecida" },
  { date: "11-02", name: "Finados" },
  { date: "11-15", name: "Proclamação da República" },
  { date: "12-25", name: "Natal" },
];

function formatDateBR(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

export default function HolidaysPage() {
  const { activeTenantId } = useTenant();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Holiday | null>(null);
  const [form, setForm] = useState({ date: "", name: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!activeTenantId) return;
    const list = await listHolidays(activeTenantId);
    setHolidays(list);
    setLoading(false);
  }, [activeTenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({ date: "", name: "" });
    setModalOpen(true);
  }

  function openEdit(h: Holiday) {
    setEditing(h);
    setForm({ date: h.date, name: h.name });
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTenantId) return;
    setError("");
    setSaving(true);
    try {
      if (editing) {
        await updateHoliday(activeTenantId, editing.id, form);
      } else {
        await createHoliday(activeTenantId, form);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError((err as Error).message ?? "Erro ao salvar o feriado.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(h: Holiday) {
    if (!activeTenantId) return;
    if (!confirm(`Excluir o feriado "${h.name}"?`)) return;
    await deleteHoliday(activeTenantId, h.id);
    await load();
  }

  async function addBrazilianHolidays() {
    if (!activeTenantId) return;
    const year = new Date().getFullYear();
    const existing = new Set(holidays.map((h) => h.date));
    for (const h of BRAZILIAN_HOLIDAYS) {
      const date = `${year}-${h.date}`;
      if (existing.has(date)) continue;
      await createHoliday(activeTenantId, { date, name: h.name });
    }
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Feriados</h1>
          <p className="text-sm text-slate-500">
            Dias sem atendimento para toda a empresa. Feriados nacionais fixos para o ano atual.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={addBrazilianHolidays} className="btn-secondary">
            Adicionar feriados nacionais ({new Date().getFullYear()})
          </button>
          <button onClick={openCreate} className="btn-primary">
            Novo feriado
          </button>
        </div>
      </div>

      {!loading && holidays.length === 0 ? (
        <EmptyState
          title="Nenhum feriado"
          description="Adicione feriados para que o sistema não ofereça horários nestes dias."
          action={
            <button onClick={openCreate} className="btn-primary">
              Criar feriado
            </button>
          }
        />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {holidays.map((h) => (
                <tr key={h.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{formatDateBR(h.date)}</td>
                  <td className="px-4 py-3 text-slate-600">{h.name}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(h)} className="text-sm text-brand-600 hover:underline">
                      Editar
                    </button>
                    <button onClick={() => handleDelete(h)} className="ml-3 text-sm text-red-600 hover:underline">
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar feriado" : "Novo feriado"}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
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
            <div>
              <label className="label">Nome *</label>
              <input
                required
                className="input"
                placeholder="Ex.: Natal"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
