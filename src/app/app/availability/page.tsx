"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenant } from "@/lib/tenant/TenantContext";
import { listProfessionals } from "@/lib/repository/professionals";
import { ensureAvailability, saveAvailability } from "@/lib/repository/availability";
import type { Professional, ProfessionalAvailability, WorkDay } from "@/types";

const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export default function AvailabilityPage() {
  const { activeTenantId } = useTenant();
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [availability, setAvailability] = useState<ProfessionalAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [daysOff, setDaysOff] = useState("");
  const [blockedDates, setBlockedDates] = useState("");

  const load = useCallback(async () => {
    if (!activeTenantId) return;
    const pros = await listProfessionals(activeTenantId);
    setProfessionals(pros);
    if (pros.length > 0 && !selectedId) setSelectedId(pros[0].id);
    setLoading(false);
  }, [activeTenantId, selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!activeTenantId || !selectedId) return;
    void ensureAvailability(activeTenantId, selectedId).then((a) => {
      setAvailability(a);
      setDaysOff(a.daysOff.join("\n"));
      setBlockedDates(a.blockedDates.join("\n"));
    });
  }, [activeTenantId, selectedId]);

  function updateWorkDay(dayOfWeek: number, patch: Partial<WorkDay>) {
    setAvailability((prev) => {
      if (!prev) return prev;
      const workDays = prev.workDays.map((w) =>
        w.dayOfWeek === dayOfWeek ? { ...w, ...patch } : w
      );
      return { ...prev, workDays };
    });
  }

  function toggleBreak(dayOfWeek: number) {
    setAvailability((prev) => {
      if (!prev) return prev;
      const workDays = prev.workDays.map((w) => {
        if (w.dayOfWeek !== dayOfWeek) return w;
        if (w.breaks.length > 0) return { ...w, breaks: [] };
        return { ...w, breaks: [{ start: "12:00", end: "13:00" }] };
      });
      return { ...prev, workDays };
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTenantId || !availability) return;
    setSaving(true);
    setSaved(false);
    try {
      await saveAvailability(activeTenantId, availability.professionalId, {
        workDays: availability.workDays,
        daysOff: daysOff.split("\n").map((s) => s.trim()).filter(Boolean),
        vacations: availability.vacations,
        blockedDates: blockedDates.split("\n").map((s) => s.trim()).filter(Boolean),
        exceptions: availability.exceptions,
      });
      setSaved(true);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-slate-500">Carregando...</p>;

  if (professionals.length === 0) {
    return (
      <p className="text-slate-500">
        Cadastre um profissional primeiro para configurar a disponibilidade.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Disponibilidade</h1>
        <p className="text-sm text-slate-500">
          Defina expediente, intervalos, folgas, férias e bloqueios por profissional.
        </p>
      </div>

      <div className="max-w-md">
        <label className="label">Profissional</label>
        <select
          className="input"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {professionals.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {availability && (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="card space-y-3">
            <h2 className="font-semibold text-slate-900">Expediente semanal</h2>
            {availability.workDays.map((w) => (
              <div key={w.dayOfWeek} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-3">
                <label className="flex w-28 items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={w.enabled}
                    onChange={(e) => updateWorkDay(w.dayOfWeek, { enabled: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600"
                  />
                  {DAY_NAMES[w.dayOfWeek]}
                </label>
                <input
                  type="time"
                  className="input w-32"
                  value={w.startTime}
                  disabled={!w.enabled}
                  onChange={(e) => updateWorkDay(w.dayOfWeek, { startTime: e.target.value })}
                />
                <span className="text-sm text-slate-500">até</span>
                <input
                  type="time"
                  className="input w-32"
                  value={w.endTime}
                  disabled={!w.enabled}
                  onChange={(e) => updateWorkDay(w.dayOfWeek, { endTime: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => toggleBreak(w.dayOfWeek)}
                  disabled={!w.enabled}
                  className="btn-secondary py-1.5 text-xs"
                >
                  {w.breaks.length > 0 ? "Remover intervalo" : "Adicionar intervalo 12h-13h"}
                </button>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card">
              <h2 className="mb-2 font-semibold text-slate-900">Folgas e bloqueios</h2>
              <p className="mb-2 text-xs text-slate-500">
                Uma data por linha, no formato AAAA-MM-DD (ex: 2025-12-25).
              </p>
              <div className="space-y-3">
                <div>
                  <label className="label">Folgas</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={daysOff}
                    onChange={(e) => setDaysOff(e.target.value)}
                    placeholder="2025-12-25"
                  />
                </div>
                <div>
                  <label className="label">Bloqueios</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={blockedDates}
                    onChange={(e) => setBlockedDates(e.target.value)}
                    placeholder="2025-12-31"
                  />
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="mb-2 font-semibold text-slate-900">Férias</h2>
              <p className="mb-3 text-xs text-slate-500">
                Períodos em que o profissional não atende. Adicione no formato AAAA-MM-DD até AAAA-MM-DD.
              </p>
              <div className="space-y-2">
                {availability.vacations.map((v, i) => (
                  <div key={v.id} className="flex items-center gap-2 text-sm">
                    <span className="text-slate-700">{v.startDate} até {v.endDate}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setAvailability((prev) =>
                          prev
                            ? { ...prev, vacations: prev.vacations.filter((x) => x.id !== v.id) }
                            : prev
                        )
                      }
                      className="text-sm text-red-600 hover:underline"
                    >
                      Remover
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  onClick={() => {
                    const from = prompt("Início (AAAA-MM-DD):");
                    const to = prompt("Fim (AAAA-MM-DD):");
                    if (from && to) {
                      setAvailability((prev) =>
                        prev
                          ? {
                              ...prev,
                              vacations: [
                                ...prev.vacations,
                                { id: `v${Date.now()}`, startDate: from, endDate: to },
                              ],
                            }
                          : prev
                      );
                    }
                  }}
                >
                  Adicionar período de férias
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Salvando..." : "Salvar disponibilidade"}
            </button>
            {saved && <span className="text-sm text-green-600">Disponibilidade salva.</span>}
          </div>
        </form>
      )}
    </div>
  );
}
