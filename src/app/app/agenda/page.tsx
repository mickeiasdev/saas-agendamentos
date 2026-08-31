"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTenant } from "@/lib/tenant/TenantContext";
import { listAppointments } from "@/lib/repository/appointments";
import { listProfessionals } from "@/lib/repository/professionals";
import { listServices } from "@/lib/repository/services";
import { formatBRL, sameDay, toDate } from "@/lib/utils/format";
import type { Appointment, Professional, Service } from "@/types";

type ViewMode = "day" | "week" | "month";

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  in_progress: "bg-violet-100 text-violet-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  no_show: "bg-slate-200 text-slate-600",
};

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export default function AgendaPage() {
  const { activeTenantId } = useTenant();
  const [view, setView] = useState<ViewMode>("day");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProfessional, setFilterProfessional] = useState("all");
  const [filterService, setFilterService] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const range = useMemo(() => {
    if (view === "day") return { from: new Date(anchor.setHours(0, 0, 0, 0)), to: addDays(new Date(anchor.setHours(0, 0, 0, 0)), 1) };
    if (view === "week") {
      const start = startOfWeek(anchor);
      return { from: start, to: addDays(start, 7) };
    }
    const from = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const to = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
    return { from, to };
  }, [view, anchor]);

  useEffect(() => {
    setAnchor(new Date());
  }, [view]);

  const load = useCallback(async () => {
    if (!activeTenantId) return;
    const [apps, pros, svcs] = await Promise.all([
      listAppointments(activeTenantId, { from: range.from, to: range.to }),
      listProfessionals(activeTenantId),
      listServices(activeTenantId),
    ]);
    setAppointments(apps);
    setProfessionals(pros);
    setServices(svcs);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTenantId, range.from.getTime(), range.to.getTime()]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const nameOf = (id: string, kind: "professional" | "service") => {
    if (kind === "professional") return professionals.find((p) => p.id === id)?.name ?? id;
    return services.find((s) => s.id === id)?.name ?? id;
  };

  const filtered = useMemo(() => {
    return appointments.filter((a) => {
      if (filterProfessional !== "all" && a.professionalId !== filterProfessional) return false;
      if (filterService !== "all" && a.serviceId !== filterService) return false;
      if (filterStatus !== "all" && a.status !== filterStatus) return false;
      return true;
    });
  }, [appointments, filterProfessional, filterService, filterStatus]);

  if (loading) return <p className="text-slate-500">Carregando...</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Agenda</h1>
          <p className="text-sm text-slate-500">Visualize e gerencie a agenda do seu negócio.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAnchor((a) => addDays(a, -1))} className="btn-secondary py-1.5">
            Anterior
          </button>
          <button onClick={() => setAnchor(new Date())} className="btn-secondary py-1.5">
            Hoje
          </button>
          <button onClick={() => setAnchor((a) => addDays(a, 1))} className="btn-secondary py-1.5">
            Próximo
          </button>
          <select
            className="input w-28 py-1.5"
            value={view}
            onChange={(e) => setView(e.target.value as ViewMode)}
          >
            <option value="day">Dia</option>
            <option value="week">Semana</option>
            <option value="month">Mês</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          className="input w-44 py-1.5"
          value={filterProfessional}
          onChange={(e) => setFilterProfessional(e.target.value)}
        >
          <option value="all">Todos os profissionais</option>
          {professionals.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          className="input w-44 py-1.5"
          value={filterService}
          onChange={(e) => setFilterService(e.target.value)}
        >
          <option value="all">Todos os serviços</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          className="input w-44 py-1.5"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="all">Todos os status</option>
          {Object.entries(STATUS_BADGE).map(([key]) => (
            <option key={key} value={key}>
              {key}
            </option>
          ))}
        </select>
      </div>

      <div className="card p-4 text-sm text-slate-600">
        {view === "month" ? (
          <MonthView
            anchor={anchor}
            appointments={filtered}
            nameOf={nameOf}
          />
        ) : (
          <ListView
            appointments={filtered}
            nameOf={nameOf}
            view={view}
            anchor={anchor}
          />
        )}
      </div>
    </div>
  );
}

function ListView({
  appointments,
  nameOf,
  view,
  anchor,
}: {
  appointments: Appointment[];
  nameOf: (id: string, kind: "professional" | "service") => string;
  view: ViewMode;
  anchor: Date;
}) {
  const days = view === "day" ? [anchor] : Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i));
  const byDay = days.map((d) => appointments.filter((a) => sameDay(toDate(a.startAt), d)));

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0,1fr))` }}>
      {days.map((d, i) => (
        <div key={d.toISOString()} className="min-w-0">
          <div className="mb-2 text-center text-xs font-semibold uppercase text-slate-500">
            {d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}
          </div>
          <div className="space-y-2">
            {byDay[i].length === 0 && (
              <p className="rounded-lg bg-slate-50 p-2 text-center text-xs text-slate-400">Sem agendamentos</p>
            )}
            {byDay[i].map((a) => (
              <div key={a.id} className="rounded-lg border border-slate-200 p-2">
                <div className="text-xs font-semibold text-slate-900">
                  {toDate(a.startAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </div>
                <div className="mt-1 text-xs text-slate-600">{nameOf(a.serviceId, "service")}</div>
                <div className="text-xs text-slate-500">{nameOf(a.professionalId, "professional")}</div>
                <div className="mt-1">
                  <span className={`badge ${STATUS_BADGE[a.status] ?? "bg-slate-100 text-slate-600"}`}>
                    {a.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MonthView({
  anchor,
  appointments,
  nameOf,
}: {
  anchor: Date;
  appointments: Appointment[];
  nameOf: (id: string, kind: "professional" | "service") => string;
}) {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const first = new Date(year, month, 1);
  const startGrid = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(startGrid, i));

  return (
    <div>
      <div className="mb-2 text-center text-sm font-semibold text-slate-700">
        {anchor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d) => {
          const dayApps = appointments.filter((a) => sameDay(toDate(a.startAt), d));
          const inMonth = d.getMonth() === month;
          return (
            <div
              key={d.toISOString()}
              className={`min-h-20 rounded-lg border p-1 ${
                inMonth ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50"
              }`}
            >
              <div className={`text-xs ${inMonth ? "text-slate-700" : "text-slate-300"}`}>
                {d.getDate()}
              </div>
              <div className="mt-1 space-y-1">
                {dayApps.slice(0, 2).map((a) => (
                  <div key={a.id} className="truncate rounded bg-brand-50 px-1 text-[10px] text-brand-700">
                    {toDate(a.startAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}{" "}
                    {nameOf(a.serviceId, "service")}
                  </div>
                ))}
                {dayApps.length > 2 && (
                  <div className="text-[10px] text-slate-400">+{dayApps.length - 2} mais</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
