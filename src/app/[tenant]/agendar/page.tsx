"use client";

import { use, useEffect, useMemo, useState } from "react";
import { formatBRL } from "@/lib/utils/format";
import type { Professional, Service, Tenant } from "@/types";

type Step = "service" | "professional" | "datetime" | "customer" | "done";

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
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = use(params);
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
  const dateLabel = date
    ? new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-100 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <span className="text-lg font-bold text-slate-900">
            {(tenant.tradeName ?? tenant.name).charAt(0).toUpperCase()}
          </span>
          <span className="text-sm text-slate-500">Agendamento online</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        {step !== "done" && (
          <ol className="mb-6 flex gap-2 text-xs text-slate-500">
            {["Serviço", "Profissional", "Data/Hora", "Dados"].map((label, i) => {
              const order: Step[] = ["service", "professional", "datetime", "customer"];
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
                  <span className={active ? "font-semibold text-slate-900" : ""}>{label}</span>
                  {i < 3 && <span className="text-slate-300">-</span>}
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
            <h1 className="text-2xl font-bold text-slate-900">Escolha o serviço</h1>
            {services.length === 0 && <p className="text-slate-500">Nenhum serviço disponível.</p>}
            {services.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setService(s);
                  setProfessional(null);
                  setStep("professional");
                }}
                className="card flex w-full items-center justify-between text-left hover:border-brand-300"
              >
                <div>
                  <div className="font-semibold text-slate-900">{s.name}</div>
                  {s.description && <div className="text-sm text-slate-500">{s.description}</div>}
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
            <h1 className="text-2xl font-bold text-slate-900">Escolha o profissional</h1>
            {eligibleProfessionals.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setProfessional(p);
                  setStep("datetime");
                }}
                className="card flex w-full items-center gap-4 text-left hover:border-brand-300"
              >
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-full font-bold text-white"
                  style={{ backgroundColor: p.color }}
                >
                  {p.name.charAt(0).toUpperCase()}
                </span>
                <div>
                  <div className="font-semibold text-slate-900">{p.name}</div>
                  {p.description && <div className="text-sm text-slate-500">{p.description}</div>}
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
            <h1 className="text-2xl font-bold text-slate-900">Escolha data e horário</h1>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="label">Data</label>
                <input
                  type="date"
                  className="input"
                  min={new Date().toISOString().split("T")[0]}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="text-sm text-slate-500">
                {professional && (
                  <div className="rounded-lg bg-slate-100 p-3">
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
              className="btn-primary w-full"
              disabled={!selectedTime}
              onClick={() => setStep("customer")}
            >
              Continuar
            </button>
          </div>
        )}

        {step === "customer" && (
          <form onSubmit={handleConfirm} className="space-y-4">
            <h1 className="text-2xl font-bold text-slate-900">Seus dados</h1>
            <div className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
              {service?.name} com {professional?.name} em {dateLabel} às {selectedTime}
            </div>
            <div>
              <label className="label">Nome completo *</label>
              <input
                required
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
              <button type="submit" className="btn-primary flex-1" disabled={creating}>
                {creating ? "Confirmando..." : "Confirmar agendamento"}
              </button>
            </div>
          </form>
        )}

        {step === "done" && (
          <div className="card text-center">
            <div
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl text-white"
              style={{ backgroundColor: primary }}
            >
              OK
            </div>
            <h1 className="mt-4 text-2xl font-bold text-slate-900">Agendamento confirmado!</h1>
            <p className="mt-2 text-sm text-slate-600">
              {service?.name} com {professional?.name} em {dateLabel} às {selectedTime}
            </p>
            {confirmedPrice !== null && confirmedPrice !== service?.price && (
              <p className="mt-1 text-sm font-semibold text-green-600">
                Valor com desconto: {formatBRL(confirmedPrice)}
              </p>
            )}
            <p className="mt-1 text-xs text-slate-400">Código: {appointmentId.slice(0, 8).toUpperCase()}</p>
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
