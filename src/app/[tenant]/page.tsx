"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { formatBRL } from "@/lib/utils/format";
import type { Professional, Service, Tenant } from "@/types";

interface PublicSiteData {
  tenant: Tenant;
  services: Service[];
  professionals: Professional[];
}

export default function PublicSitePage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = use(params);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    void fetch(`/api/public/site/${encodeURIComponent(slug)}`)
      .then(async (res) => {
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error("Não foi possível carregar o site.");
        const data = (await res.json()) as PublicSiteData;
        setTenant(data.tenant);
        setServices(data.services);
        setProfessionals(data.professionals);
      })
      .catch(() => setNotFound(true));
  }, [slug]);

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900">Empresa não encontrada</h1>
          <p className="mt-2 text-sm text-slate-500">
            Verifique o endereço ou entre em contato com a empresa.
          </p>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">Carregando...</div>;
  }

  const primary = tenant.branding.primaryColor ?? "#4f46e5";

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-100">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-lg text-lg font-bold text-white"
              style={{ backgroundColor: primary }}
            >
              {(tenant.tradeName ?? tenant.name).charAt(0).toUpperCase()}
            </span>
            <span className="text-lg font-bold text-slate-900">
              {tenant.tradeName ?? tenant.name}
            </span>
          </div>
          <Link
            href={`/${slug}/agendar`}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: primary }}
          >
            Agendar
          </Link>
        </div>
      </header>

      <main>
        <section className="py-16 text-center">
          <div className="mx-auto max-w-3xl px-6">
            <h1
              className="text-4xl font-extrabold tracking-tight"
              style={{ color: primary }}
            >
              {tenant.tradeName ?? tenant.name}
            </h1>
            <p className="mt-3 text-lg text-slate-600">
              {tenant.description ?? "Agende seu horário online em poucos minutos."}
            </p>
            <div className="mt-8">
              <Link
                href={`/${slug}/agendar`}
                className="rounded-lg px-8 py-3 text-base font-semibold text-white"
                style={{ backgroundColor: primary }}
              >
                Agendar agora
              </Link>
            </div>
          </div>
        </section>

        {services.length > 0 && (
          <section className="py-12">
            <div className="mx-auto max-w-5xl px-6">
              <h2 className="mb-6 text-2xl font-bold text-slate-900">Serviços</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {services.map((s) => (
                  <div key={s.id} className="rounded-xl border border-slate-200 p-5">
                    <h3 className="font-semibold text-slate-900">{s.name}</h3>
                    {s.description && (
                      <p className="mt-1 text-sm text-slate-500">{s.description}</p>
                    )}
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-lg font-bold" style={{ color: primary }}>
                        {formatBRL(s.price)}
                      </span>
                      <span className="text-sm text-slate-500">{s.durationMinutes} min</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {professionals.length > 0 && (
          <section className="py-12">
            <div className="mx-auto max-w-5xl px-6">
              <h2 className="mb-6 text-2xl font-bold text-slate-900">Profissionais</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {professionals.map((p) => (
                  <div key={p.id} className="rounded-xl border border-slate-200 p-5 text-center">
                    <span
                      className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold text-white"
                      style={{ backgroundColor: p.color }}
                    >
                      {p.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="mt-3 font-semibold text-slate-900">{p.name}</div>
                    {p.description && (
                      <p className="mt-1 text-sm text-slate-500">{p.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {tenant.branding.showContact && (
          <section className="py-12">
            <div className="mx-auto max-w-5xl px-6">
              <h2 className="mb-6 text-2xl font-bold text-slate-900">Contato</h2>
              <div className="grid gap-4 text-sm text-slate-600 sm:grid-cols-2">
                {tenant.phone && <div>Telefone: {tenant.phone}</div>}
                {tenant.whatsapp && <div>WhatsApp: {tenant.whatsapp}</div>}
                {tenant.email && <div>E-mail: {tenant.email}</div>}
                {tenant.address?.city && (
                  <div>
                    {tenant.address.street ?? ""} {tenant.address.number ?? ""} -{" "}
                    {tenant.address.city} / {tenant.address.state}
                  </div>
                )}
                {tenant.instagram && <div>Instagram: @{tenant.instagram}</div>}
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-slate-100 py-8 text-center text-sm text-slate-400">
        {tenant.tradeName ?? tenant.name} — agendamento online
      </footer>
    </div>
  );
}
