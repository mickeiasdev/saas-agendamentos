"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { publicThemeClasses } from "@/lib/branding/theme";
import { formatBRL } from "@/lib/utils/format";
import type { Professional, Service, Tenant } from "@/types";

interface ScheduleEntry {
  dayOfWeek: number;
  label: string;
  open: string;
  close: string;
}

interface PublicSiteData {
  tenant: Tenant;
  services: Service[];
  professionals: Professional[];
  schedule: ScheduleEntry[];
}

export default function PublicSitePage({
  params,
}: {
  params: { tenant: string };
}) {
  const slug = params.tenant;
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
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
        setSchedule(data.schedule ?? []);
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

  const branding = tenant.branding;
  const primary = branding.primaryColor ?? "#4f46e5";
  const secondary = branding.secondaryColor ?? "#0f172a";
  const fontFamily = branding.font ?? undefined;
  const theme = publicThemeClasses(branding.theme);

  const sectionOrder =
    branding.sectionOrder?.length
      ? branding.sectionOrder
      : ["services", "professionals", "schedule", "gallery", "testimonials", "faq", "contact"];

  const social = branding.socialLinks ?? {};

  const sections: Record<string, React.ReactNode> = {
    services:
      services.length > 0 ? (
        <section className="py-12">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className={`mb-6 text-2xl font-bold ${theme.heading}`}>Serviços</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((s) => (
                <div key={s.id} className={theme.card}>
                  <h3 className={`font-semibold ${theme.heading}`}>{s.name}</h3>
                  {s.description && (
                    <p className={`mt-1 text-sm ${theme.muted}`}>{s.description}</p>
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
      ) : null,
    professionals:
      professionals.length > 0 ? (
        <section className="py-12">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className={`mb-6 text-2xl font-bold ${theme.heading}`}>Profissionais</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {professionals.map((p) => (
                <div key={p.id} className={`${theme.card} text-center`}>
                  <span
                    className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold text-white"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </span>
                  <div className={`mt-3 font-semibold ${theme.heading}`}>{p.name}</div>
                  {p.description && (
                    <p className={`mt-1 text-sm ${theme.muted}`}>{p.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null,
    schedule:
      schedule.length > 0 ? (
        <section className="py-12">
          <div className="mx-auto max-w-3xl px-6">
            <h2 className={`mb-6 text-2xl font-bold ${theme.heading}`}>Horários de funcionamento</h2>
            <div className={`divide-y rounded-xl border ${theme.divider}`}>
              {schedule.map((s) => (
                <div key={s.dayOfWeek} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className={`font-medium ${theme.heading}`}>{s.label}</span>
                  <span className={theme.body}>
                    {s.open} - {s.close}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null,
    gallery:
      branding.galleryUrls?.length ? (
        <section className="py-12">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className={`mb-6 text-2xl font-bold ${theme.heading}`}>Galeria</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {branding.galleryUrls.map((u) => (
                <img key={u} src={u} alt="" className="h-32 w-full rounded-xl object-cover" loading="lazy" />
              ))}
            </div>
          </div>
        </section>
      ) : null,
    testimonials:
      branding.testimonials?.length ? (
        <section className="py-12">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className={`mb-6 text-2xl font-bold ${theme.heading}`}>Depoimentos</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {branding.testimonials.map((t) => (
                <div key={t.id} className={theme.card}>
                  <div className="text-amber-500">{"★".repeat(Math.max(0, Math.min(5, t.rating)))}</div>
                  <p className={`mt-2 text-sm ${theme.body}`}>{"“"}{t.text}{"”"}</p>
                  <div className={`mt-3 text-sm font-semibold ${theme.heading}`}>{t.author}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null,
    faq:
      branding.faq?.length ? (
        <section className="py-12">
          <div className="mx-auto max-w-3xl px-6">
            <h2 className={`mb-6 text-2xl font-bold ${theme.heading}`}>Perguntas frequentes</h2>
            <div className="space-y-3">
              {branding.faq.map((f) => (
                <details key={f.id} className={`${theme.card} p-4`}>
                  <summary className={`cursor-pointer font-medium ${theme.heading}`}>{f.question}</summary>
                  <p className={`mt-2 text-sm ${theme.body}`}>{f.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      ) : null,
    contact:
      branding.showContact ? (
        <section className="py-12">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className={`mb-6 text-2xl font-bold ${theme.heading}`}>Contato</h2>
            <div className={`grid gap-4 text-sm sm:grid-cols-2 ${theme.body}`}>
              {tenant.phone && <div>Telefone: {tenant.phone}</div>}
              {tenant.whatsapp && <div>WhatsApp: {tenant.whatsapp}</div>}
              {tenant.email && <div>E-mail: {tenant.email}</div>}
              {branding.showLocation && tenant.address?.city && (
                <div>
                  {tenant.address.street ?? ""} {tenant.address.number ?? ""} -{" "}
                  {tenant.address.city} / {tenant.address.state}
                </div>
              )}
              {tenant.instagram && <div>Instagram: @{tenant.instagram}</div>}
              {Object.entries(social).filter(([, v]) => v).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(social).map(([key, value]) =>
                    value ? (
                      <a
                        key={key}
                        href={key === "instagram" || key === "tiktok" || key === "x" ? `https://www.instagram.com/${value.replace("@", "")}` : value}
                        target="_blank"
                        rel="noreferrer"
                        className={`rounded-lg border px-3 py-1 text-xs capitalize hover:opacity-80 ${theme.divider} ${theme.body}`}
                      >
                        {key}
                      </a>
                    ) : null
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      ) : null,
  };

  const rendered = new Set<string>();
  const ordered = sectionOrder
    .map((id) => {
      if (!sections[id]) return null;
      rendered.add(id);
      return sections[id];
    })
    .filter(Boolean);
  const remainder = Object.entries(sections)
    .filter(([id, node]) => node && !rendered.has(id))
    .map(([, node]) => node);

  return (
    <div className={theme.page} style={{ fontFamily }} data-theme={branding.theme ?? "light"}>
      {branding.bannerUrl && (
        <div className="h-48 w-full overflow-hidden sm:h-64">
          <img src={branding.bannerUrl} alt="" className="h-full w-full object-cover" />
        </div>
      )}
      <header className={theme.header}>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            {tenant.logoUrl ? (
              <img src={tenant.logoUrl} alt={tenant.tradeName ?? tenant.name} className="h-10 w-10 rounded-lg object-cover" />
            ) : (
              <span
                className="flex h-10 w-10 items-center justify-center rounded-lg text-lg font-bold text-white"
                style={{ backgroundColor: primary }}
              >
                {(tenant.tradeName ?? tenant.name).charAt(0).toUpperCase()}
              </span>
            )}
            <span className={`text-lg font-bold ${theme.heading}`}>
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
            <p className={`mt-3 text-lg ${theme.body}`}>
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

        {ordered}
        {remainder}
      </main>

      <footer className={`${theme.footer} py-8 text-center text-sm`} style={{ color: secondary }}>
        {tenant.tradeName ?? tenant.name} — agendamento online
      </footer>
    </div>
  );
}
