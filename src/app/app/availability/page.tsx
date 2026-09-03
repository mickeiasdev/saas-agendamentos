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
  const [daysOff, setDaysOff] = useState<string[]>([]);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [dayOffDraft, setDayOffDraft] = useState("");
  const [blockedDraft, setBlockedDraft] = useState("");
  const [vacStart, setVacStart] = useState("");
  const [vacEnd, setVacEnd] = useState("");
  const [vacReason, setVacReason] = useState("");
  const [excDate, setExcDate] = useState("");
  const [excStart, setExcStart] = useState("");
  const [excEnd, setExcEnd] = useState("");
  const [excReason, setExcReason] = useState("");

  function addException(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTenantId) return;
    const date = excDate.trim();
    if (!date) return;
    setAvailability((prev) =>
      prev
        ? {
            ...prev,
            exceptions: [
              ...prev.exceptions,
              {
                id: `exc${Date.now()}`,
                tenantId: activeTenantId,
                date,
                startTime: excStart || undefined,
                endTime: excEnd || undefined,
                reason: excReason.trim() || "Exceção de expediente",
              },
            ],
          }
        : prev
    );
    setExcDate("");
    setExcStart("");
    setExcEnd("");
    setExcReason("");
  }

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
      setDaysOff(a.daysOff ?? []);
      setBlockedDates(a.blockedDates ?? []);
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

  function updateBreak(dayOfWeek: number, field: "start" | "end", value: string) {
    setAvailability((prev) => {
      if (!prev) return prev;
      const workDays = prev.workDays.map((w) => {
        if (w.dayOfWeek !== dayOfWeek) return w;
        const current = w.breaks[0] ?? { start: "12:00", end: "13:00" };
        return { ...w, breaks: [{ ...current, [field]: value }] };
      });
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
        daysOff,
        vacations: availability.vacations,
        blockedDates,
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
          Defina expediente, intervalos, folgas, férias, bloqueios e exceções por profissional.
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
                {w.breaks.length > 0 ? (
                  <>
                    <span className="text-xs text-slate-500">intervalo</span>
                    <input
                      type="time"
                      className="input w-28"
                      value={w.breaks[0].start}
                      disabled={!w.enabled}
                      onChange={(e) => updateBreak(w.dayOfWeek, "start", e.target.value)}
                    />
                    <span className="text-sm text-slate-500">até</span>
                    <input
                      type="time"
                      className="input w-28"
                      value={w.breaks[0].end}
                      disabled={!w.enabled}
                      onChange={(e) => updateBreak(w.dayOfWeek, "end", e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => toggleBreak(w.dayOfWeek)}
                      disabled={!w.enabled}
                      className="btn-secondary py-1.5 text-xs"
                    >
                      Remover intervalo
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleBreak(w.dayOfWeek)}
                    disabled={!w.enabled}
                    className="btn-secondary py-1.5 text-xs"
                  >
                    Adicionar intervalo
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card">
              <h2 className="mb-2 font-semibold text-slate-900">Folgas e bloqueios</h2>
              <p className="mb-2 text-xs text-slate-500">Selecione a data no calendário.</p>
              <div className="space-y-4">
                <div>
                  <label className="label">Folgas</label>
                  <div className="flex gap-2">
                    <input type="date" className="input" value={dayOffDraft} onChange={(e) => setDayOffDraft(e.target.value)} />
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        if (!dayOffDraft || daysOff.includes(dayOffDraft)) return;
                        setDaysOff((prev) => [...prev, dayOffDraft].sort());
                        setDayOffDraft("");
                      }}
                    >
                      Adicionar
                    </button>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {daysOff.map((d) => (
                      <li key={d} className="flex items-center justify-between text-sm">
                        <span>{d}</span>
                        <button type="button" className="text-red-600 hover:underline" onClick={() => setDaysOff((prev) => prev.filter((x) => x !== d))}>
                          Remover
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <label className="label">Bloqueios</label>
                  <div className="flex gap-2">
                    <input type="date" className="input" value={blockedDraft} onChange={(e) => setBlockedDraft(e.target.value)} />
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        if (!blockedDraft || blockedDates.includes(blockedDraft)) return;
                        setBlockedDates((prev) => [...prev, blockedDraft].sort());
                        setBlockedDraft("");
                      }}
                    >
                      Adicionar
                    </button>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {blockedDates.map((d) => (
                      <li key={d} className="flex items-center justify-between text-sm">
                        <span>{d}</span>
                        <button type="button" className="text-red-600 hover:underline" onClick={() => setBlockedDates((prev) => prev.filter((x) => x !== d))}>
                          Remover
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="mb-2 font-semibold text-slate-900">Férias</h2>
              <p className="mb-3 text-xs text-slate-500">Períodos em que o profissional não atende.</p>
              <div className="space-y-2">
                {availability.vacations.map((v) => (
                  <div key={v.id} className="flex items-center gap-2 text-sm">
                    <span className="text-slate-700">{v.startDate} até {v.endDate}{v.reason ? ` · ${v.reason}` : ""}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setAvailability((prev) =>
                          prev ? { ...prev, vacations: prev.vacations.filter((x) => x.id !== v.id) } : prev
                        )
                      }
                      className="text-sm text-red-600 hover:underline"
                    >
                      Remover
                    </button>
                  </div>
                ))}
                <div className="grid gap-2 sm:grid-cols-3">
                  <input type="date" className="input" value={vacStart} onChange={(e) => setVacStart(e.target.value)} />
                  <input type="date" className="input" value={vacEnd} onChange={(e) => setVacEnd(e.target.value)} />
                  <input className="input" placeholder="Motivo (opcional)" value={vacReason} onChange={(e) => setVacReason(e.target.value)} />
                </div>
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  onClick={() => {
                    if (!vacStart || !vacEnd) return;
                    setAvailability((prev) =>
                      prev
                        ? {
                            ...prev,
                            vacations: [
                              ...prev.vacations,
                              { id: `v${Date.now()}`, startDate: vacStart, endDate: vacEnd, reason: vacReason.trim() || undefined },
                            ],
                          }
                        : prev
                    );
                    setVacStart("");
                    setVacEnd("");
                    setVacReason("");
                  }}
                >
                  Adicionar período de férias
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="mb-2 font-semibold text-slate-900">Exceções de expediente</h2>
            <p className="mb-3 text-xs text-slate-500">
              Horário especial para uma data específica (ex.: feriado com atendimento, ou
              alteração pontual). Deixe os horários em branco para indicar que o profissional
              não atende nessa data.
            </p>
            {availability.exceptions.length === 0 ? (
              <p className="mb-3 text-sm text-slate-500">Nenhuma exceção cadastrada.</p>
            ) : (
              <ul className="mb-3 divide-y divide-slate-100">
                {availability.exceptions.map((exc) => (
                  <li key={exc.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div>
                      <span className="font-medium text-slate-900">{exc.date}</span>
                      <span className="ml-2 text-slate-600">
                        {exc.startTime && exc.endTime
                          ? `${exc.startTime} às ${exc.endTime}`
                          : "Fechado"}
                      </span>
                      <span className="ml-2 text-xs text-slate-400">{exc.reason}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setAvailability((prev) =>
                          prev
                            ? { ...prev, exceptions: prev.exceptions.filter((x) => x.id !== exc.id) }
                            : prev
                        )
                      }
                      className="text-sm text-red-600 hover:underline"
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={addException} className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-4">
              <div>
                <label className="label">Data *</label>
                <input
                  required
                  type="date"
                  className="input"
                  value={excDate}
                  onChange={(e) => setExcDate(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Início</label>
                <input
                  type="time"
                  className="input"
                  value={excStart}
                  onChange={(e) => setExcStart(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Fim</label>
                <input
                  type="time"
                  className="input"
                  value={excEnd}
                  onChange={(e) => setExcEnd(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Motivo</label>
                <input
                  className="input"
                  value={excReason}
                  onChange={(e) => setExcReason(e.target.value)}
                  placeholder="Ex.: feriado municipal"
                />
              </div>
              <div className="sm:col-span-4">
                <button type="submit" className="btn-secondary text-sm">
                  Adicionar exceção
                </button>
              </div>
            </form>
          </div>

          <div className="flex items-center gap-4">
            <button type="submit" data-testid="availability-save" className="btn-primary" disabled={saving}>
              {saving ? "Salvando..." : "Salvar disponibilidade"}
            </button>
            {saved && <span className="text-sm text-green-600">Disponibilidade salva.</span>}
          </div>
        </form>
      )}
    </div>
  );
}
