"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenant } from "@/lib/tenant/TenantContext";
import { DEFAULT_TZ, instantFromWallClock, wallClockOf } from "@/lib/booking/timezone";
import {
  createAppointment,
  listAppointments,
  rescheduleAppointment,
  updateAppointmentStatus,
} from "@/lib/repository/appointments";
import { listCustomers } from "@/lib/repository/customers";
import { listProfessionals } from "@/lib/repository/professionals";
import { listServices } from "@/lib/repository/services";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { addMinutes, formatDateTime } from "@/lib/utils/format";
import type { Appointment, AppointmentStatus, Customer, Professional, Service } from "@/types";

const STATUS_OPTIONS: AppointmentStatus[] = [
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
];

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  in_progress: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
};

export default function AppointmentsPage() {
  const { activeTenantId, activeTenant } = useTenant();
  const tz = activeTenant?.settings?.timezone || DEFAULT_TZ;
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    customerId: "",
    professionalId: "",
    serviceId: "",
    date: "",
    time: "09:00",
    notes: "",
  });

  const [rescheduleForm, setRescheduleForm] = useState({
    professionalId: "",
    serviceId: "",
    date: "",
    time: "09:00",
  });

  const load = useCallback(async () => {
    if (!activeTenantId) return;
    const [apps, custs, pros, svcs] = await Promise.all([
      listAppointments(activeTenantId, {
        from: new Date(0),
        to: new Date(8640000000000000),
        status: statusFilter === "all" ? undefined : statusFilter,
      }),
      listCustomers(activeTenantId, { pageSize: 100 }),
      listProfessionals(activeTenantId),
      listServices(activeTenantId, true),
    ]);
    setAppointments(apps.sort((a, b) => toNumber(a.startAt) - toNumber(b.startAt)));
    setCustomers(custs.items);
    setProfessionals(pros);
    setServices(svcs);
    setLoading(false);
  }, [activeTenantId, statusFilter]);

  function toNumber(v: Appointment["startAt"]): number {
    const d = v && "toDate" in v && typeof v.toDate === "function" ? v.toDate() : new Date(String(v));
    return d.getTime();
  }

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const customerName = (id: string) => customers.find((c) => c.id === id)?.name ?? id;
  const professionalName = (id: string) => professionals.find((p) => p.id === id)?.name ?? id;
  const serviceName = (id: string) => services.find((s) => s.id === id)?.name ?? id;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTenantId) return;
    setError("");
    setSaving(true);
    try {
      const service = services.find((s) => s.id === form.serviceId);
      if (!service) throw new Error("Selecione um serviço.");
      const startAt = instantFromWallClock(form.date, form.time, tz);
      await createAppointment({
        tenantId: activeTenantId,
        professionalId: form.professionalId,
        serviceId: form.serviceId,
        customerId: form.customerId,
        startAt,
        endAt: addMinutes(startAt, service.durationMinutes),
        price: service.price,
        notes: form.notes || undefined,
        createdBy: "manager",
      });
      setModalOpen(false);
      setForm({ customerId: "", professionalId: "", serviceId: "", date: "", time: "09:00", notes: "" });
      await load();
    } catch (err) {
      setError((err as Error).message ?? "Erro ao criar agendamento.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(a: Appointment, status: AppointmentStatus) {
    if (!activeTenantId) return;
    await updateAppointmentStatus(activeTenantId, a.id, status);
    await load();
  }

  async function handleCancel(a: Appointment) {
    if (!activeTenantId) return;
    if (!window.confirm("Cancelar este agendamento?")) return;
    await updateAppointmentStatus(activeTenantId, a.id, "cancelled", {
      cancellationReason: "cancelado no painel",
    });
    await load();
  }

  function openReschedule(a: Appointment) {
    const start = toDateValue(a.startAt);
    const wall = wallClockOf(start, tz);
    setRescheduleTarget(a);
    setRescheduleForm({
      professionalId: a.professionalId,
      serviceId: a.serviceId,
      date: wall.date,
      time: wall.time,
    });
    setError("");
  }

  function toDateValue(v: Appointment["startAt"]): Date {
    return v && typeof v === "object" && "toDate" in v && typeof v.toDate === "function"
      ? v.toDate()
      : new Date(String(v));
  }

  async function handleReschedule(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTenantId || !rescheduleTarget) return;
    setError("");
    setSaving(true);
    try {
      const service = services.find((s) => s.id === rescheduleForm.serviceId);
      if (!service) throw new Error("Selecione um serviço.");
      const startAt = instantFromWallClock(rescheduleForm.date, rescheduleForm.time, tz);
      await rescheduleAppointment({
        tenantId: activeTenantId,
        appointmentId: rescheduleTarget.id,
        professionalId: rescheduleForm.professionalId,
        serviceId: rescheduleForm.serviceId,
        startAt,
        endAt: addMinutes(startAt, service.durationMinutes),
      });
      setRescheduleTarget(null);
      await load();
    } catch (err) {
      setError((err as Error).message ?? "Erro ao remarcar.");
    } finally {
      setSaving(false);
    }
  }

  const canReschedule = (a: Appointment) =>
    a.status !== "cancelled" && a.status !== "completed" && a.status !== "no_show";
  const canCancel = canReschedule;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Agendamentos</h1>
          <p className="text-sm text-slate-500">
            Crie agendamentos e altere o status de cada atendimento.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select className="input w-44" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Todos os status</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <button onClick={() => setModalOpen(true)} className="btn-primary">
            Novo agendamento
          </button>
        </div>
      </div>

      {!loading && appointments.length === 0 ? (
        <EmptyState
          title="Nenhum agendamento"
          description="Crie um agendamento manualmente ou pelo site público."
          action={
            <button onClick={() => setModalOpen(true)} className="btn-primary">
              Novo agendamento
            </button>
          }
        />
      ) : (
        <>
          <div className="hidden md:block">
            <div className="card overflow-x-auto p-0">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Data/Hora</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Serviço</th>
                    <th className="px-4 py-3">Profissional</th>
                    <th className="px-4 py-3">Preço</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {appointments.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{formatDateTime(a.startAt)}</td>
                      <td className="px-4 py-3 text-slate-700">{customerName(a.customerId)}</td>
                      <td className="px-4 py-3 text-slate-600">{serviceName(a.serviceId)}</td>
                      <td className="px-4 py-3 text-slate-600">{professionalName(a.professionalId)}</td>
                      <td className="px-4 py-3 text-slate-900">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(a.price)}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="input py-1 text-xs"
                          value={a.status}
                          onChange={(e) => void changeStatus(a, e.target.value as AppointmentStatus)}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-3">
                          {canReschedule(a) && (
                            <button
                              type="button"
                              className="text-xs font-medium text-brand-600 hover:underline"
                              onClick={() => openReschedule(a)}
                            >
                              Remarcar
                            </button>
                          )}
                          {canCancel(a) && (
                            <button
                              type="button"
                              className="text-xs font-medium text-red-600 hover:underline"
                              onClick={() => void handleCancel(a)}
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="space-y-3 md:hidden">
            {appointments.map((a) => (
              <div key={a.id} className="card space-y-2">
                <div className="font-semibold text-slate-900">{formatDateTime(a.startAt)}</div>
                <div className="text-sm text-slate-700">{customerName(a.customerId)}</div>
                <div className="text-sm text-slate-600">
                  {serviceName(a.serviceId)} · {professionalName(a.professionalId)}
                </div>
                <div className="text-sm font-medium text-slate-900">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(a.price)}
                </div>
                <select
                  className="input py-1 text-xs"
                  value={a.status}
                  onChange={(e) => void changeStatus(a, e.target.value as AppointmentStatus)}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
                <div className="flex gap-3 pt-1">
                  {canReschedule(a) && (
                    <button
                      type="button"
                      className="text-xs font-medium text-brand-600 hover:underline"
                      onClick={() => openReschedule(a)}
                    >
                      Remarcar
                    </button>
                  )}
                  {canCancel(a) && (
                    <button
                      type="button"
                      className="text-xs font-medium text-red-600 hover:underline"
                      onClick={() => void handleCancel(a)}
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Novo agendamento">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Cliente *</label>
              <select
                required
                className="input"
                value={form.customerId}
                onChange={(e) => setForm({ ...form, customerId: e.target.value })}
              >
                <option value="">Selecione...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Serviço *</label>
              <select
                required
                className="input"
                value={form.serviceId}
                onChange={(e) => setForm({ ...form, serviceId: e.target.value })}
              >
                <option value="">Selecione...</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.durationMinutes} min)
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Profissional *</label>
            <select
              required
              className="input"
              value={form.professionalId}
              onChange={(e) => setForm({ ...form, professionalId: e.target.value })}
            >
              <option value="">Selecione...</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
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
              <label className="label">Horário *</label>
              <input
                required
                type="time"
                className="input"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label">Observações</label>
            <textarea
              className="input"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-500">
            A disponibilidade do profissional é validada novamente no backend — horários
            ocupados ou conflitantes serão recusados.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Criando..." : "Criar agendamento"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        title="Remarcar agendamento"
      >
        <form onSubmit={handleReschedule} className="space-y-4">
          <p className="text-sm text-slate-600">
            Cliente: <b>{rescheduleTarget ? customerName(rescheduleTarget.customerId) : ""}</b>
          </p>
          <div>
            <label className="label">Serviço *</label>
            <select
              required
              className="input"
              value={rescheduleForm.serviceId}
              onChange={(e) => setRescheduleForm({ ...rescheduleForm, serviceId: e.target.value })}
            >
              <option value="">Selecione...</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.durationMinutes} min)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Profissional *</label>
            <select
              required
              className="input"
              value={rescheduleForm.professionalId}
              onChange={(e) => setRescheduleForm({ ...rescheduleForm, professionalId: e.target.value })}
            >
              <option value="">Selecione...</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Data *</label>
              <input
                required
                type="date"
                className="input"
                value={rescheduleForm.date}
                onChange={(e) => setRescheduleForm({ ...rescheduleForm, date: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Horário *</label>
              <input
                required
                type="time"
                className="input"
                value={rescheduleForm.time}
                onChange={(e) => setRescheduleForm({ ...rescheduleForm, time: e.target.value })}
              />
            </div>
          </div>
          <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-500">
            A disponibilidade é validada na transação. Horários ocupados serão recusados.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setRescheduleTarget(null)} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Remarcando..." : "Confirmar remarcação"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
