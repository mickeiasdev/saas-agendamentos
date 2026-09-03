"use client";

import { useEffect, useMemo, useState } from "react";
import { publicThemeClasses } from "@/lib/branding/theme";
import { formatBRL } from "@/lib/utils/format";
import type { Professional, Service, Tenant } from "@/types";

type Step = "service" | "professional" | "datetime" | "customer" | "confirm" | "done";

interface BookResponse {
  ok?: boolean;
  appointmentId?: string;
  price?: number;
  error?: string;
}

interface PublicSiteData {
  tenant: Tenant;
  services: Service[];
  professionals: Professional[];
}

export default function BookingPage({
  params,
}: {
  params: { tenant: string };
}) {
  const slug = params.tenant;
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [notFound, setNotFound] = useState(false);

  const [step, setStep] = useState<Step>("service");
  const [service, setService] = useState<Service | null>(null);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [date, setDate] = useState("");
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [form, setForm] = useState({ name: "", phone: "", email: "", coupon: "" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [appointmentId, setAppointmentId] = useState("");
  const [confirmedPrice, setConfirmedPrice] = useState<number | null>(null);
  const [doneAction, setDoneAction] = useState<"idle" | "cancelled" | "rescheduled">("idle");
  const [cancelling, setCancelling] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTimes, setRescheduleTimes] = useState<string[]>([]);
  const [rescheduleTime, setRescheduleTime] = useState<string | null>(null);
  const [loadingRescheduleSlots, setLoadingRescheduleSlots] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);

  useEffect(() => {
    void fetch(`/api/public/site/${encodeURIComponent(slug)}`)
      .then(async (res) => {
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error("Não foi possível carregar a empresa.");
        const data = (await res.json()) as PublicSiteData;
        setTenant(data.tenant);
        setServices(data.services);
        setProfessionals(data.professionals);
      })
      .catch(() => setNotFound(true));
  }, [slug]);

  const eligibleProfessionals = useMemo(() => {
    if (!service) return professionals;
    const ids = service.professionals;
    if (!ids || ids.length === 0) return professionals;
    return professionals.filter((p) => ids.includes(p.id));
  }, [service, professionals]);

  useEffect(() => {
    if (!date || !professional || !service || !tenant) return;
    setLoadingSlots(true);
    setSelectedTime(null);
    setError("");

    const params = new URLSearchParams({
      tenant: tenant.slug,
      serviceId: service.id,
      professionalId: professional.id,
      date,
    });

    void fetch(`/api/public/slots?${params.toString()}`)
      .then(async (res) => {
        const data = (await res.json()) as { slots?: string[]; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Não foi possível consultar os horários.");
        setAvailableTimes(data.slots ?? []);
      })
      .catch((err) => {
        setError((err as Error).message);
        setAvailableTimes([]);
      })
      .finally(() => setLoadingSlots(false));
  }, [date, professional, service, tenant]);

  useEffect(() => {
    if (!showReschedule || !rescheduleDate || !professional || !service || !tenant) return;
    setLoadingRescheduleSlots(true);
    setRescheduleTime(null);
    const params = new URLSearchParams({
      tenant: tenant.slug,
      serviceId: service.id,
      professionalId: professional.id,
      date: rescheduleDate,
    });
    void fetch(`/api/public/slots?${params.toString()}`)
      .then(async (res) => {
        const data = (await res.json()) as { slots?: string[]; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Não foi possível consultar os horários.");
        setRescheduleTimes(data.slots ?? []);
      })
      .catch((err) => {
        setError((err as Error).message);
        setRescheduleTimes([]);
      })
      .finally(() => setLoadingRescheduleSlots(false));
  }, [showReschedule, rescheduleDate, professional, service, tenant]);

  async function handleCancel() {
    if (!tenant || !appointmentId) return;
    setError("");
    setCancelling(true);
    try {
      const res = await fetch("/api/public/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantSlug: tenant.slug, appointmentId }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Não foi possível cancelar.");
      setDoneAction("cancelled");
      setShowReschedule(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCancelling(false);
    }
  }

  async function handleReschedule(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant || !appointmentId || !rescheduleDate || !rescheduleTime) return;
    setError("");
    setRescheduling(true);
    try {
      const res = await fetch("/api/public/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug: tenant.slug,
          appointmentId,
          date: rescheduleDate,
          time: rescheduleTime,
          professionalId: professional?.id,
          serviceId: service?.id,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; appointmentId?: string; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Não foi possível remarcar.");
      setAppointmentId(data.appointmentId ?? appointmentId);
      setDate(rescheduleDate);
      setSelectedTime(rescheduleTime);
      setDoneAction("rescheduled");
      setShowReschedule(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRescheduling(false);
    }
  }

  async function handleCustomerSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("Informe o nome completo.");
      return;
    }
    if (!form.phone.trim()) {
      setError("Informe o WhatsApp.");
      return;
    }
    setStep("confirm");
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant || !service || !professional || !selectedTime) return;
    setError("");
    setCreating(true);
    try {
      const res = await fetch("/api/public/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug: tenant.slug,
          serviceId: service.id,
          professionalId: professional.id,
          date,
          time: selectedTime,
          couponCode: form.coupon || undefined,
          notes: undefined,
          customer: {
            name: form.name,
            phone: form.phone || undefined,
            email: form.email || undefined,
          },
        }),
      });
      const data = (await res.json()) as BookResponse;
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Não foi possível confirmar o agendamento.");
      }
      setAppointmentId(data.appointmentId ?? "");
      setConfirmedPrice(data.price ?? service.price);
      setDoneAction("idle");
      setShowReschedule(false);
      setStep("done");
    } catch (err) {
      setError((err as Error).message ?? "Não foi possível confirmar o agendamento.");
    } finally {
      setCreating(false);
    }
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900">Empresa não encontrada</h1>
          <p className="mt-2 text-sm text-slate-500">Verifique o endereço acessado.</p>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">Carregando...</div>;
  }

  const primary = tenant.branding.primaryColor ?? "#4f46e5";
  const theme = publicThemeClasses(tenant.branding.theme);
  const dateLabel = date
    ? new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "";

  return (
    <div
      className={theme.dark ? "min-h-screen bg-slate-950 text-slate-100" : "min-h-screen bg-slate-50 text-slate-900"}
      data-theme={tenant.branding.theme ?? "light"}
    >
      <header className={theme.header}>
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <span className={`text-lg font-bold ${theme.heading}`}>
            {(tenant.tradeName ?? tenant.name).charAt(0).toUpperCase()}
          </span>
          <span className={`text-sm ${theme.muted}`}>Agendamento online</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        {step !== "done" && (
          <ol className="mb-6 flex gap-2 text-xs text-slate-500">
            {["Serviço", "Profissional", "Data/Hora", "Dados", "Confirmação"].map((label, i) => {
              const order: Step[] = ["service", "professional", "datetime", "customer", "confirm"];
              const active = order.indexOf(step) === i;
              const done = order.indexOf(step) > i;
              return (
                <li key={label} className="flex items-center gap-2">
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
                    style={{
                      backgroundColor: done || active ? primary : "#e2e8f0",
                      color: done || active ? "#fff" : "#64748b",
                    }}
                  >
                    {i + 1}
                  </span>
                   <span className={active ? `font-semibold ${theme.heading}` : theme.muted}>{label}</span>
                  {i < 4 && <span className="text-slate-300">-</span>}
                </li>
              );
            })}
          </ol>
        )}

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {step === "service" && (
          <div className="space-y-3">
            <h1 className={`text-2xl font-bold ${theme.heading}`}>Escolha o serviço</h1>
            {services.length === 0 && <p className={theme.muted}>Nenhum serviço disponível.</p>}
            {services.map((s) => (
              <button
                key={s.id}
                data-testid={`book-service-${s.id}`}
                onClick={() => {
                  setService(s);
                  setProfessional(null);
                  setStep("professional");
                }}
                className="card flex w-full items-center gap-3 text-left hover:border-brand-300"
              >
                {s.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <div className={`font-semibold ${theme.heading}`}>{s.name}</div>
                  {s.description && <div className={`text-sm ${theme.muted}`}>{s.description}</div>}
                </div>
                <div className="text-right">
                  <div className="font-bold" style={{ color: primary }}>
                    {formatBRL(s.price)}
                  </div>
                  <div className="text-xs text-slate-500">{s.durationMinutes} min</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {step === "professional" && (
          <div className="space-y-3">
            <h1 className={`text-2xl font-bold ${theme.heading}`}>Escolha o profissional</h1>
            {eligibleProfessionals.map((p) => (
              <button
                key={p.id}
                data-testid={`book-professional-${p.id}`}
                onClick={() => {
                  setProfessional(p);
                  setStep("datetime");
                }}
                className="card flex w-full items-center gap-4 text-left hover:border-brand-300"
              >
                {p.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photoUrl} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                ) : (
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-full font-bold text-white"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div>
                  <div className={`font-semibold ${theme.heading}`}>{p.name}</div>
                  {p.description && <div className={`text-sm ${theme.muted}`}>{p.description}</div>}
                </div>
              </button>
            ))}
            {eligibleProfessionals.length === 0 && (
              <p className="text-slate-500">Nenhum profissional disponível para este serviço.</p>
            )}
          </div>
        )}

        {step === "datetime" && (
          <div className="space-y-6">
            <h1 className={`text-2xl font-bold ${theme.heading}`}>Escolha data e horário</h1>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="label">Data</label>
                <input
                  type="date"
                  data-testid="book-date"
                  className="input"
                  min={new Date().toISOString().split("T")[0]}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className={`text-sm ${theme.muted}`}>
                {professional && (
                  <div className={theme.panel}>
                    Profissional: <b>{professional.name}</b>
                    <br />
                    Serviço: <b>{service?.name}</b> ({service?.durationMinutes} min)
                  </div>
                )}
              </div>
            </div>

            {date && (
              <div>
                <label className="label">Horários disponíveis</label>
                {loadingSlots ? (
                  <p className="text-slate-500">Calculando horários...</p>
                ) : availableTimes.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Nenhum horário disponível nesta data. Escolha outra data.
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {availableTimes.map((time) => (
                      <button
                        key={time}
                        type="button"
                        data-testid={`book-slot-${time}`}
                        onClick={() => setSelectedTime(time)}
                        className="rounded-lg border px-2 py-2 text-sm font-medium"
                        style={{
                          backgroundColor: selectedTime === time ? primary : "#fff",
                          color: selectedTime === time ? "#fff" : "#334155",
                          borderColor: selectedTime === time ? primary : "#e2e8f0",
                        }}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              data-testid="book-continue"
              className="btn-primary w-full"
              disabled={!selectedTime}
              onClick={() => setStep("customer")}
            >
              Continuar
            </button>
          </div>
        )}

        {step === "customer" && (
          <form onSubmit={handleCustomerSubmit} className="space-y-4">
            <h1 className={`text-2xl font-bold ${theme.heading}`}>Seus dados</h1>
            <div className={`${theme.panel} text-sm ${theme.body}`}>
              {service?.name} com {professional?.name} em {dateLabel} às {selectedTime}
            </div>
            <div>
              <label className="label">Nome completo *</label>
              <input
                required
                data-testid="book-customer-name"
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">WhatsApp *</label>
                <input
                  required
                  data-testid="book-customer-phone"
                  className="input"
                  placeholder="(11) 99999-9999"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="label">E-mail</label>
                <input
                  type="email"
                  className="input"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="label">Cupom de desconto</label>
              <input
                className="input"
                placeholder="Opcional — ex.: BEMVINDO10"
                value={form.coupon}
                onChange={(e) => setForm({ ...form, coupon: e.target.value })}
              />
            </div>
            <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-500">
              O horário é validado novamente no servidor na confirmação. Se alguém reservar ao
              mesmo tempo, o sistema recusa e você escolhe outro horário.
            </p>
            <div className="flex gap-3">
              <button type="button" className="btn-secondary" onClick={() => setStep("datetime")}>
                Voltar
              </button>
              <button type="submit" data-testid="book-review" className="btn-primary flex-1">
                Revisar e continuar
              </button>
            </div>
          </form>
        )}

        {step === "confirm" && (
          <form onSubmit={handleConfirm} className="space-y-4">
            <h1 className={`text-2xl font-bold ${theme.heading}`}>Confirme o agendamento</h1>
            <div className={`${theme.panel} space-y-2 text-sm ${theme.body}`}>
              <div className="flex justify-between gap-3">
                <span className={theme.muted}>Serviço</span>
                <span className="font-medium">{service?.name}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className={theme.muted}>Profissional</span>
                <span className="font-medium">{professional?.name}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className={theme.muted}>Data</span>
                <span className="font-medium">{dateLabel}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className={theme.muted}>Horário</span>
                <span className="font-medium">{selectedTime}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className={theme.muted}>Duração</span>
                <span className="font-medium">{service?.durationMinutes} min</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className={theme.muted}>Valor</span>
                <span className="font-medium">{service ? formatBRL(service.price) : "-"}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className={theme.muted}>Cliente</span>
                <span className="font-medium">{form.name}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className={theme.muted}>WhatsApp</span>
                <span className="font-medium">{form.phone}</span>
              </div>
              {form.email && (
                <div className="flex justify-between gap-3">
                  <span className={theme.muted}>E-mail</span>
                  <span className="font-medium">{form.email}</span>
                </div>
              )}
              {form.coupon && (
                <div className="flex justify-between gap-3">
                  <span className={theme.muted}>Cupom</span>
                  <span className="font-medium">{form.coupon}</span>
                </div>
              )}
            </div>
            <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-500">
              O horário é validado novamente no servidor na confirmação. Se alguém reservar ao
              mesmo tempo, o sistema recusa e você escolhe outro horário.
            </p>
            <div className="flex gap-3">
              <button type="button" className="btn-secondary" onClick={() => setStep("customer")}>
                Voltar
              </button>
              <button type="submit" data-testid="book-confirm" className="btn-primary flex-1" disabled={creating}>
                {creating ? "Confirmando..." : "Confirmar agendamento"}
              </button>
            </div>
          </form>
        )}

        {step === "done" && (
          <div className="card text-center">
            <div
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl text-white"
              style={{ backgroundColor: doneAction === "cancelled" ? "#64748b" : primary }}
            >
              {doneAction === "cancelled" ? "X" : "OK"}
            </div>
              <h1 data-testid="book-done" className={`mt-4 text-2xl font-bold ${theme.heading}`}>
              {doneAction === "cancelled"
                ? "Agendamento cancelado"
                : doneAction === "rescheduled"
                  ? "Agendamento remarcado!"
                  : "Agendamento confirmado!"}
            </h1>
            {doneAction !== "cancelled" && (
              <p className="mt-2 text-sm text-slate-600">
                {service?.name} com {professional?.name} em {dateLabel} às {selectedTime}
              </p>
            )}
            {doneAction !== "cancelled" && confirmedPrice !== null && confirmedPrice !== service?.price && (
              <p className="mt-1 text-sm font-semibold text-green-600">
                Valor com desconto: {formatBRL(confirmedPrice)}
              </p>
            )}
            <p className="mt-1 text-xs text-slate-400">Código: {appointmentId.slice(0, 8).toUpperCase()}</p>

            {doneAction !== "cancelled" && !showReschedule && (
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowReschedule(true);
                    setRescheduleDate(date);
                    setError("");
                  }}
                >
                  Remarcar
                </button>
                <button
                  type="button"
                  className="btn-secondary text-red-700"
                  disabled={cancelling}
                  onClick={() => void handleCancel()}
                >
                  {cancelling ? "Cancelando..." : "Cancelar agendamento"}
                </button>
              </div>
            )}

            {showReschedule && doneAction !== "cancelled" && (
              <form onSubmit={handleReschedule} className="mt-6 space-y-4 text-left">
                <h2 className={`text-lg font-semibold ${theme.heading}`}>Escolha o novo horário</h2>
                <div>
                  <label className="label">Data</label>
                  <input
                    type="date"
                    className="input"
                    min={new Date().toISOString().split("T")[0]}
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    required
                  />
                </div>
                {rescheduleDate && (
                  <div>
                    <label className="label">Horários disponíveis</label>
                    {loadingRescheduleSlots ? (
                      <p className="text-sm text-slate-500">Calculando horários...</p>
                    ) : rescheduleTimes.length === 0 ? (
                      <p className="text-sm text-slate-500">Nenhum horário nesta data.</p>
                    ) : (
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                        {rescheduleTimes.map((time) => (
                          <button
                            key={time}
                            type="button"
                            onClick={() => setRescheduleTime(time)}
                            className="rounded-lg border px-2 py-2 text-sm font-medium"
                            style={{
                              backgroundColor: rescheduleTime === time ? primary : "#fff",
                              color: rescheduleTime === time ? "#fff" : "#334155",
                              borderColor: rescheduleTime === time ? primary : "#e2e8f0",
                            }}
                          >
                            {time}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex gap-3">
                  <button type="button" className="btn-secondary" onClick={() => setShowReschedule(false)}>
                    Voltar
                  </button>
                  <button type="submit" className="btn-primary flex-1" disabled={rescheduling || !rescheduleTime}>
                    {rescheduling ? "Remarcando..." : "Confirmar remarcação"}
                  </button>
                </div>
              </form>
            )}

            <div className="mt-6">
              <a href={`/${slug}`} className="btn-secondary">
                Voltar ao site
              </a>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
