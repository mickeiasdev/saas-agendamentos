"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenant } from "@/lib/tenant/TenantContext";
import { listAppointments } from "@/lib/repository/appointments";
import { listProfessionals } from "@/lib/repository/professionals";
import { listServices } from "@/lib/repository/services";
import { formatBRL, toDate } from "@/lib/utils/format";
import type { Appointment, Professional, Service } from "@/types";

type Period = "7d" | "month" | "lastMonth" | "all";

const PERIODS: { id: Period; label: string }[] = [
  { id: "7d", label: "Últimos 7 dias" },
  { id: "month", label: "Este mês" },
  { id: "lastMonth", label: "Mês passado" },
  { id: "all", label: "Todos" },
];

function rangeFor(period: Period): { from: Date; to: Date } {
  const now = new Date();
  if (period === "7d") {
    const from = new Date(now);
    from.setDate(from.getDate() - 7);
    return { from, to: now };
  }
  if (period === "month") {
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: now,
    };
  }
  if (period === "lastMonth") {
    return {
      from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      to: new Date(now.getFullYear(), now.getMonth(), 1),
    };
  }
  return { from: new Date(0), to: new Date(8640000000000000) };
}

export default function ReportsPage() {
  const { activeTenantId } = useTenant();
  const [period, setPeriod] = useState<Period>("month");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeTenantId) return;
    const range = rangeFor(period);
    const [apps, pros, svcs] = await Promise.all([
      listAppointments(activeTenantId, { from: range.from, to: range.to }),
      listProfessionals(activeTenantId),
      listServices(activeTenantId),
    ]);
    setAppointments(apps);
    setProfessionals(pros);
    setServices(svcs);
    setLoading(false);
  }, [activeTenantId, period]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const byStatus = (s: string) => appointments.filter((a) => a.status === s).length;
  const revenueStatuses = ["confirmed", "in_progress", "completed"];
  const revenue = appointments
    .filter((a) => revenueStatuses.includes(a.status))
    .reduce((sum, a) => sum + (a.price ?? 0), 0);
  const ticket = revenue / Math.max(1, appointments.filter((a) => revenueStatuses.includes(a.status)).length);

  const byProfessional = professionals
    .map((p) => ({
      name: p.name,
      count: appointments.filter((a) => a.professionalId === p.id).length,
      revenue: appointments
        .filter((a) => a.professionalId === p.id && revenueStatuses.includes(a.status))
        .reduce((sum, a) => sum + (a.price ?? 0), 0),
    }))
    .sort((a, b) => b.count - a.count);

  const byService = services
    .map((s) => ({
      name: s.name,
      count: appointments.filter((a) => a.serviceId === s.id).length,
      revenue: appointments
        .filter((a) => a.serviceId === s.id && revenueStatuses.includes(a.status))
        .reduce((sum, a) => sum + (a.price ?? 0), 0),
    }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  if (loading) return <p className="text-slate-500">Carregando...</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Relatórios</h1>
          <p className="text-sm text-slate-500">Faturamento, ocupação e desempenho dos serviços.</p>
        </div>
        <select className="input w-44 py-1.5" value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
          {PERIODS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <div className="text-3xl font-bold text-brand-600">{formatBRL(revenue)}</div>
          <div className="text-sm text-slate-500">Faturamento</div>
        </div>
        <div className="card">
          <div className="text-3xl font-bold text-slate-900">{appointments.length}</div>
          <div className="text-sm text-slate-500">Agendamentos</div>
        </div>
        <div className="card">
          <div className="text-3xl font-bold text-slate-900">{formatBRL(ticket)}</div>
          <div className="text-sm text-slate-500">Ticket médio</div>
        </div>
        <div className="card">
          <div className="text-3xl font-bold text-amber-600">{byStatus("cancelled")}</div>
          <div className="text-sm text-slate-500">Cancelamentos</div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <div className="text-2xl font-bold text-blue-600">{byStatus("confirmed")}</div>
          <div className="text-sm text-slate-500">Confirmados</div>
        </div>
        <div className="card">
          <div className="text-2xl font-bold text-green-600">{byStatus("completed")}</div>
          <div className="text-sm text-slate-500">Concluídos</div>
        </div>
        <div className="card">
          <div className="text-2xl font-bold text-violet-600">{byStatus("in_progress")}</div>
          <div className="text-sm text-slate-500">Em andamento</div>
        </div>
        <div className="card">
          <div className="text-2xl font-bold text-slate-600">{byStatus("no_show")}</div>
          <div className="text-sm text-slate-500">Não compareceram</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-semibold text-slate-900">Ocupação por profissional</h2>
          {byProfessional.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum dado no período.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="pb-2">Profissional</th>
                  <th className="pb-2">Agendamentos</th>
                  <th className="pb-2 text-right">Faturamento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {byProfessional.map((p) => (
                  <tr key={p.name}>
                    <td className="py-2 font-medium text-slate-900">{p.name}</td>
                    <td className="py-2 text-slate-600">{p.count}</td>
                    <td className="py-2 text-right text-slate-900">{formatBRL(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2 className="mb-3 font-semibold text-slate-900">Serviços mais rentáveis</h2>
          {byService.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum serviço vendido no período.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="pb-2">Serviço</th>
                  <th className="pb-2">Vendas</th>
                  <th className="pb-2 text-right">Faturamento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {byService.map((s) => (
                  <tr key={s.name}>
                    <td className="py-2 font-medium text-slate-900">{s.name}</td>
                    <td className="py-2 text-slate-600">{s.count}</td>
                    <td className="py-2 text-right text-slate-900">{formatBRL(s.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-400">
        Relatórios calculados com base nos agendamentos do período selecionado.
      </p>
    </div>
  );
}
