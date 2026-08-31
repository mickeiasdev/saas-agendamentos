"use client";

import { use, useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { generateSlots, type SlotGenerationOptions } from "@/lib/availability/engine";
import { createAppointment } from "@/lib/repository/appointments";
import { upsertCustomer } from "@/lib/repository/customers";
import { formatBRL, timeToMinutes } from "@/lib/utils/format";
import type {
  Appointment,
  Holiday,
  Professional,
  ProfessionalAvailability,
  Service,
  Slot,
  Tenant,
} from "@/types";

type Step = "service" | "professional" | "datetime" | "customer" | "done";

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
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [appointmentId, setAppointmentId] = useState("");

  useEffect(() => {
    const db = getFirebaseFirestore();
    const q = query(collection(db, "tenants"), where("slug", "==", slug), limit(1));
    void getDocs(q).then(async (snap) => {
      if (snap.empty) {
        setNotFound(true);
        return;
      }
      const t = { id: snap.docs[0].id, ...snap.docs[0].data() } as Tenant;
      setTenant(t);
      const svcSnap = await getDocs(
        query(collection(db, "tenants", t.id, "services"), where("status", "==", "active"))
      );
      setServices(svcSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Service));
      const proSnap = await getDocs(
        query(collection(db, "tenants", t.id, "professionals"), where("active", "==", true))
      );
      setProfessionals(proSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Professional));
    });
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
    setSelectedSlot(null);

    const db = getFirebaseFirestore();
    void (async () => {
      try {
        const availSnap = await getDocs(
          query(
            collection(db, "tenants", tenant.id, "availability"),
            where("professionalId", "==", professional.id)
          )
        );
        const availability = availSnap.empty
          ? null
          : ({ id: availSnap.docs[0].id, ...availSnap.docs[0].data() } as ProfessionalAvailability);

        const holSnap = await getDocs(collection(db, "tenants", tenant.id, "holidays"));
        const holidays = holSnap.docs.map((d) => d.data()) as Holiday[];

        const start = new Date(`${date}T00:00:00`);
        const end = new Date(`${date}T23:59:59`);
        const appSnap = await getDocs(
          query(
            collection(db, "tenants", tenant.id, "appointments"),
            where("startAt", ">=", start),
            where("startAt", "<=", end)
          )
        );
        const appointments = appSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Appointment);

        const opts: SlotGenerationOptions = {
          availability,
          serviceDurationMinutes: service.durationMinutes,
          appointments,
          holidays,
          slotIntervalMinutes: tenant.settings.slotIntervalMinutes,
          date,
        };
        setSlots(generateSlots(opts));
      } catch (err) {
        setError((err as Error).message);
        setSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    })();
  }, [date, professional, service, tenant]);

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant || !service || !professional || !selectedSlot) return;
    setError("");
    setCreating(true);
    try {
      const db = getFirebaseFirestore();
      const customerId = await upsertCustomer(tenant.id, undefined, {
        name: form.name,
        phone: form.phone || undefined,
        email: form.email || undefined,
      });
      const id = await createAppointment({
        tenantId: tenant.id,
        professionalId: professional.id,
        serviceId: service.id,
        customerId,
        startAt: selectedSlot.start,
        endAt: selectedSlot.end,
        price: service.price,
        createdBy: "customer",
      });
      setAppointmentId(id);
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
  const availableSlots = slots.filter((s) => s.available);

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
                ) : availableSlots.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Nenhum horário disponível nesta data. Escolha outra data.
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {availableSlots.map((slot, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className="rounded-lg border px-2 py-2 text-sm font-medium"
                        style={{
                          backgroundColor: selectedSlot === slot ? primary : "#fff",
                          color: selectedSlot === slot ? "#fff" : "#334155",
                          borderColor: selectedSlot === slot ? primary : "#e2e8f0",
                        }}
                      >
                        {slot.start.toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              className="btn-primary w-full"
              disabled={!selectedSlot}
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
              {service?.name} com {professional?.name} em{" "}
              {selectedSlot?.start.toLocaleDateString("pt-BR")} às{" "}
              {selectedSlot?.start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
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
            <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-500">
              O horário é validado novamente na confirmação. Se alguém reservar ao mesmo tempo,
              o sistema recusa e você escolhe outro horário.
            </p>
            <div className="flex gap-3">
              <button type="button" className="btn-secondary" onClick={() => setStep("datetime")}>
                Voltar
              </button>
              <button type="submit" className="btn-primary flex-1" disabled={creating}>
                {creating ? "Confirmando..." : `Confirmar agendamento`}
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
              {service?.name} com {professional?.name} em{" "}
              {selectedSlot?.start.toLocaleDateString("pt-BR")} às{" "}
              {selectedSlot?.start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
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
