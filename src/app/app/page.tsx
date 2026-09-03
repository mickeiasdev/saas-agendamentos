"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTenant } from "@/lib/tenant/TenantContext";
import { listAppointments } from "@/lib/repository/appointments";
import { listServices } from "@/lib/repository/services";
import { listProfessionals } from "@/lib/repository/professionals";
import { countCustomers } from "@/lib/repository/customers";
import { formatBRL, formatDateTime } from "@/lib/utils/format";
import type { Appointment, Professional, Service } from "@/types";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  in_progress: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
};

export default function DashboardPage() {
  const { activeTenant, activeTenantId } = useTenant();
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [stats, setStats] = useState({ services: 0, professionals: 0, customers: 0 });

  useEffect(() => {
    if (!activeTenantId) return;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    end.setMilliseconds(end.getMilliseconds() - 1);

    void Promise.all([
      listAppointments(activeTenantId, { from: start, to: end }),
      listServices(activeTenantId),
      listProfessionals(activeTenantId),
      countCustomers(activeTenantId),
    ]).then(([appointments, svcs, pros, customerCount]) => {
      setTodayAppointments(appointments);
      setServices(svcs);
      setProfessionals(pros);
      setStats({
        services: svcs.length,
        professionals: pros.length,
        customers: customerCount,
      });
    });
  }, [activeTenantId]);

  if (!activeTenant) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Olá, {activeTenant.tradeName ?? activeTenant.name}!
        </h1>
        <p className="text-sm text-slate-500">Resumo do seu negócio hoje.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/app/agenda" className="card hover:border-brand-300">
          <div className="text-3xl font-bold text-brand-600">{todayAppointments.length}</div>
          <div className="text-sm text-slate-500">Agendamentos hoje</div>
        </Link>
        <Link href="/app/services" className="card hover:border-brand-300">
          <div className="text-3xl font-bold text-brand-600">{stats.services}</div>
          <div className="text-sm text-slate-500">Serviços</div>
        </Link>
        <Link href="/app/professionals" className="card hover:border-brand-300">
          <div className="text-3xl font-bold text-brand-600">{stats.professionals}</div>
          <div className="text-sm text-slate-500">Profissionais</div>
        </Link>
        <Link href="/app/customers" className="card hover:border-brand-300">
          <div className="text-3xl font-bold text-brand-600">{stats.customers}</div>
          <div className="text-sm text-slate-500">Clientes</div>
        </Link>
      </div>

      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Agenda de hoje</h2>
          <Link href="/app/agenda" className="text-sm text-brand-600 hover:underline">
            Ver agenda completa
          </Link>
        </div>
        {todayAppointments.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum agendamento para hoje.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {todayAppointments.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm font-medium text-slate-900">
                    {formatDateTime(a.startAt)}
                  </div>
                  <div className="text-xs text-slate-500">
                    {services.find((s) => s.id === a.serviceId)?.name ?? a.serviceId}
                    {" · "}
                    {professionals.find((p) => p.id === a.professionalId)?.name ?? a.professionalId}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-700">
                    {formatBRL(a.price)}
                  </span>
                  <span className="badge bg-slate-100 text-slate-700">
                    {STATUS_LABEL[a.status] ?? a.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
