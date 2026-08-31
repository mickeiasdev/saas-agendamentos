"use client";

import { useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { useTenant } from "@/lib/tenant/TenantContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { can } from "@/lib/rbac/roles";
import { getRoleForTenant } from "@/lib/rbac/membership";
import type { FaqItem, Testimonial, TenantBranding } from "@/types";

const FONT_OPTIONS = [
  { id: "system-ui", label: "Padrão (sistema)", value: "system-ui, -apple-system, sans-serif" },
  { id: "inter", label: "Inter (moderno)", value: "'Inter', 'Segoe UI', sans-serif" },
  { id: "serif", label: "Serifada (elegante)", value: "Georgia, 'Times New Roman', serif" },
  { id: "mono", label: "Monoespaçada (técnica)", value: "'Courier New', monospace" },
];

const SECTION_OPTIONS = [
  { id: "services", label: "Serviços" },
  { id: "professionals", label: "Profissionais" },
  { id: "schedule", label: "Horários" },
  { id: "gallery", label: "Galeria" },
  { id: "testimonials", label: "Depoimentos" },
  { id: "faq", label: "FAQ" },
  { id: "contact", label: "Contato" },
];

const uid = () => Math.random().toString(36).slice(2, 10);

export default function SettingsPage() {
  const { activeTenant, activeTenantId, memberships, refreshActiveTenant } = useTenant();
  const { user, changePassword, verifyEmail } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logoUrl, setLogoUrl] = useState(activeTenant?.logoUrl ?? "");
  const [bannerUrl, setBannerUrl] = useState(activeTenant?.branding.bannerUrl ?? "");
  const [primaryColor, setPrimaryColor] = useState(activeTenant?.branding.primaryColor ?? "#4f46e5");
  const [secondaryColor, setSecondaryColor] = useState(activeTenant?.branding.secondaryColor ?? "#0f172a");
  const [font, setFont] = useState(
    FONT_OPTIONS.some((f) => f.value === activeTenant?.branding.font) || !activeTenant?.branding.font
      ? (activeTenant?.branding.font ?? "system-ui")
      : "system-ui"
  );
  const [theme, setTheme] = useState<"light" | "dark">(activeTenant?.branding.theme ?? "light");
  const [showContact, setShowContact] = useState(activeTenant?.branding.showContact ?? true);
  const [showLocation, setShowLocation] = useState(activeTenant?.branding.showLocation ?? true);
  const [gallery, setGallery] = useState<string[]>(activeTenant?.branding.galleryUrls ?? []);
  const [galleryText, setGalleryText] = useState((activeTenant?.branding.galleryUrls ?? []).join("\n"));
  const [testimonials, setTestimonials] = useState<Testimonial[]>(activeTenant?.branding.testimonials ?? []);
  const [faq, setFaq] = useState<FaqItem[]>(activeTenant?.branding.faq ?? []);
  const [social, setSocial] = useState<Record<string, string>>(activeTenant?.branding.socialLinks ?? {});
  const [sectionOrder, setSectionOrder] = useState<string[]>(
    activeTenant?.branding.sectionOrder?.length ? activeTenant.branding.sectionOrder : ["services", "professionals", "schedule", "contact"]
  );
  const [testimonialDraft, setTestimonialDraft] = useState({ author: "", text: "", rating: 5 });
  const [faqDraft, setFaqDraft] = useState({ question: "", answer: "" });
  const [passForm, setPassForm] = useState({ newPassword: "", confirm: "" });
  const [passError, setPassError] = useState("");
  const [passMsg, setPassMsg] = useState("");
  const [passSaving, setPassSaving] = useState(false);
  const [emailMsg, setEmailMsg] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);

  if (!activeTenant || !activeTenantId) return null;

  const tenantId = activeTenantId;
  const tenant = activeTenant;
  const role = getRoleForTenant(memberships, tenantId)?.role;
  const canManage = can(role, "settings.manage");
  const platformDomain = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "minhaplataforma.com";
  const publicUrl = `https://${activeTenant.slug}.${platformDomain}`;

  function moveSection(index: number, dir: -1 | 1) {
    setSectionOrder((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setSaving(true);
    setSaved(false);
    try {
      const branding: TenantBranding = {
        primaryColor,
        secondaryColor,
        font: FONT_OPTIONS.find((f) => f.id === font)?.value ?? font,
        theme,
        bannerUrl: bannerUrl || undefined,
        galleryUrls: galleryText
          .split("\n")
          .map((u) => u.trim())
          .filter(Boolean),
        testimonials,
        faq,
        socialLinks: social,
        showContact,
        showLocation,
        sectionOrder,
      };
      const db = getFirebaseFirestore();
      const patch: Record<string, unknown> = { branding, updatedAt: serverTimestamp() };
      if (logoUrl !== tenant.logoUrl) patch.logoUrl = logoUrl || null;
      await updateDoc(doc(db, "tenants", tenantId), patch);
      setSaved(true);
      await refreshActiveTenant();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configurações</h1>
        <p className="text-sm text-slate-500">Personalização avançada do site público e dados da empresa.</p>
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold text-slate-900">Site público</h2>
        <p className="mb-2 text-sm text-slate-600">
          Seu site público fica disponível em:
        </p>
        <a
          href={publicUrl}
          target="_blank"
          rel="noreferrer"
          className="break-all text-brand-600 underline"
        >
          {publicUrl}
        </a>
        <p className="mt-2 text-xs text-slate-500">
          No ambiente de preview local, acesse <code className="rounded bg-slate-100 px-1">/{activeTenant.slug}</code> na aplicação.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="card space-y-4">
          <h2 className="font-semibold text-slate-900">Identidade</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Logo (URL)</label>
              <input
                className="input"
                value={logoUrl}
                disabled={!canManage}
                placeholder="https://.../logo.png"
                onChange={(e) => setLogoUrl(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Banner (URL)</label>
              <input
                className="input"
                value={bannerUrl}
                disabled={!canManage}
                placeholder="https://.../banner.jpg"
                onChange={(e) => setBannerUrl(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="font-semibold text-slate-900">Aparência</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">Cor principal</label>
              <input
                type="color"
                className="h-11 w-full cursor-pointer rounded-lg border border-slate-300"
                value={primaryColor}
                disabled={!canManage}
                onChange={(e) => setPrimaryColor(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Cor secundária</label>
              <input
                type="color"
                className="h-11 w-full cursor-pointer rounded-lg border border-slate-300"
                value={secondaryColor}
                disabled={!canManage}
                onChange={(e) => setSecondaryColor(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Tema</label>
              <select
                className="input"
                value={theme}
                disabled={!canManage}
                onChange={(e) => setTheme(e.target.value as "light" | "dark")}
              >
                <option value="light">Claro</option>
                <option value="dark">Escuro</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Fonte do site</label>
            <select
              className="input"
              value={font}
              disabled={!canManage}
              onChange={(e) => setFont(e.target.value)}
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="font-semibold text-slate-900">Galeria</h2>
          <p className="text-xs text-slate-500">Uma URL de imagem por linha (aparecem na seção de galeria do site).</p>
          <textarea
            className="input"
            rows={4}
            value={galleryText}
            disabled={!canManage}
            onChange={(e) => setGalleryText(e.target.value)}
            placeholder={"https://.../foto1.jpg\nhttps://.../foto2.jpg"}
          />
          {gallery.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {gallery.map((u) => (
                <img key={u} src={u} alt="" className="h-16 w-16 rounded-lg object-cover" />
              ))}
            </div>
          )}
        </div>

        <div className="card space-y-4">
          <h2 className="font-semibold text-slate-900">Depoimentos</h2>
          {testimonials.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum depoimento cadastrado.</p>
          ) : (
            <ul className="space-y-2">
              {testimonials.map((t, i) => (
                <li key={t.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">
                      {t.author} <span className="text-amber-500">{"★".repeat(t.rating)}</span>
                    </div>
                    <div className="truncate text-sm text-slate-600">{t.text}</div>
                  </div>
                  <button
                    type="button"
                    disabled={!canManage}
                    onClick={() => setTestimonials((prev) => prev.filter((x) => x.id !== t.id))}
                    className="ml-3 text-sm text-red-600 hover:underline"
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}
          {canManage && (
            <div className="space-y-3 rounded-lg bg-slate-50 p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className="input"
                  placeholder="Nome do cliente"
                  value={testimonialDraft.author}
                  onChange={(e) => setTestimonialDraft({ ...testimonialDraft, author: e.target.value })}
                />
                <select
                  className="input"
                  value={testimonialDraft.rating}
                  onChange={(e) => setTestimonialDraft({ ...testimonialDraft, rating: Number(e.target.value) })}
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} estrelas
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                className="input"
                rows={2}
                placeholder="Texto do depoimento"
                value={testimonialDraft.text}
                onChange={(e) => setTestimonialDraft({ ...testimonialDraft, text: e.target.value })}
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  if (!testimonialDraft.author.trim() || !testimonialDraft.text.trim()) return;
                  setTestimonials((prev) => [
                    ...prev,
                    { id: uid(), author: testimonialDraft.author.trim(), text: testimonialDraft.text.trim(), rating: testimonialDraft.rating },
                  ]);
                  setTestimonialDraft({ author: "", text: "", rating: 5 });
                }}
              >
                Adicionar depoimento
              </button>
            </div>
          )}
        </div>

        <div className="card space-y-4">
          <h2 className="font-semibold text-slate-900">FAQ</h2>
          {faq.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma pergunta cadastrada.</p>
          ) : (
            <ul className="space-y-2">
              {faq.map((f) => (
                <li key={f.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900">{f.question}</div>
                    <button
                      type="button"
                      disabled={!canManage}
                      onClick={() => setFaq((prev) => prev.filter((x) => x.id !== f.id))}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Remover
                    </button>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{f.answer}</p>
                </li>
              ))}
            </ul>
          )}
          {canManage && (
            <div className="space-y-3 rounded-lg bg-slate-50 p-3">
              <input
                className="input"
                placeholder="Pergunta"
                value={faqDraft.question}
                onChange={(e) => setFaqDraft({ ...faqDraft, question: e.target.value })}
              />
              <textarea
                className="input"
                rows={2}
                placeholder="Resposta"
                value={faqDraft.answer}
                onChange={(e) => setFaqDraft({ ...faqDraft, answer: e.target.value })}
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  if (!faqDraft.question.trim() || !faqDraft.answer.trim()) return;
                  setFaq((prev) => [
                    ...prev,
                    { id: uid(), question: faqDraft.question.trim(), answer: faqDraft.answer.trim() },
                  ]);
                  setFaqDraft({ question: "", answer: "" });
                }}
              >
                Adicionar pergunta
              </button>
            </div>
          )}
        </div>

        <div className="card space-y-4">
          <h2 className="font-semibold text-slate-900">Redes sociais</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { key: "instagram", label: "Instagram", placeholder: "@suaempresa" },
              { key: "facebook", label: "Facebook", placeholder: "URL ou página" },
              { key: "tiktok", label: "TikTok", placeholder: "@suaempresa" },
              { key: "youtube", label: "YouTube", placeholder: "URL do canal" },
              { key: "x", label: "X / Twitter", placeholder: "@suaempresa" },
              { key: "linkedin", label: "LinkedIn", placeholder: "URL do perfil" },
            ].map((s) => (
              <div key={s.key}>
                <label className="label">{s.label}</label>
                <input
                  className="input"
                  value={social[s.key] ?? ""}
                  disabled={!canManage}
                  placeholder={s.placeholder}
                  onChange={(e) => setSocial({ ...social, [s.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="card space-y-3">
          <h2 className="font-semibold text-slate-900">Ordem das seções do site</h2>
          <ul className="space-y-2">
            {sectionOrder.map((id, i) => {
              const label = SECTION_OPTIONS.find((s) => s.id === id)?.label ?? id;
              return (
                <li key={id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <span className="font-medium text-slate-900">{label}</span>
                  <span className="flex items-center gap-2">
                    <button type="button" disabled={!canManage || i === 0} onClick={() => moveSection(i, -1)} className="btn-secondary px-2 py-1 text-xs">
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={!canManage || i === sectionOrder.length - 1}
                      onClick={() => moveSection(i, 1)}
                      className="btn-secondary px-2 py-1 text-xs"
                    >
                      ↓
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-slate-500">
            Seções presentes no site mas não listadas aqui são exibidas por padrão.
          </p>
        </div>

        <div className="card space-y-3">
          <h2 className="font-semibold text-slate-900">Contato e localização</h2>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-600"
                checked={showContact}
                disabled={!canManage}
                onChange={(e) => setShowContact(e.target.checked)}
              />
              Mostrar contato no site
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-600"
                checked={showLocation}
                disabled={!canManage}
                onChange={(e) => setShowLocation(e.target.checked)}
              />
              Mostrar localização no site
            </label>
          </div>
          {!canManage && (
            <p className="text-sm text-amber-600">
              Apenas o proprietário ou administrador pode alterar as configurações.
            </p>
          )}
          {canManage && (
            <div className="flex items-center gap-3">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Salvando..." : "Salvar alterações"}
              </button>
              {saved && <span className="text-sm text-green-600">Alterações salvas.</span>}
            </div>
          )}
        </div>
      </form>

      <div className="card">
        <h2 className="mb-3 font-semibold text-slate-900">Dados da empresa</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Nome</dt>
            <dd className="font-medium text-slate-900">{activeTenant.name}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Nome fantasia</dt>
            <dd className="font-medium text-slate-900">{activeTenant.tradeName ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">CPF/CNPJ</dt>
            <dd className="font-medium text-slate-900">{activeTenant.cnpjCpf ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Telefone / WhatsApp</dt>
            <dd className="font-medium text-slate-900">
              {activeTenant.phone ?? "-"} {activeTenant.whatsapp ? `/ ${activeTenant.whatsapp}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Plano</dt>
            <dd className="font-medium text-slate-900">{activeTenant.planId}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Assinatura</dt>
            <dd className="font-medium text-slate-900">{activeTenant.subscriptionStatus}</dd>
          </div>
        </dl>
      </div>

      <div className="card space-y-4">
        <div>
          <h2 className="font-semibold text-slate-900">Conta e segurança</h2>
          <p className="text-sm text-slate-500">Alteração de senha e verificação de e-mail.</p>
        </div>

        {user && !user.emailVerified && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            <span>Seu e-mail ainda não foi verificado.</span>
            <button
              className="btn-secondary py-1.5 text-xs"
              disabled={emailSaving}
              onClick={async () => {
                setEmailSaving(true);
                setEmailMsg("");
                try {
                  await verifyEmail();
                  setEmailMsg("E-mail de verificação enviado. Verifique sua caixa de entrada.");
                } catch (err) {
                  setEmailMsg((err as Error).message ?? "Erro ao enviar verificação.");
                } finally {
                  setEmailSaving(false);
                }
              }}
            >
              {emailSaving ? "Enviando..." : "Reenviar verificação"}
            </button>
          </div>
        )}
        {emailMsg && <p className="text-sm text-green-600">{emailMsg}</p>}

        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setPassError("");
            setPassMsg("");
            if (passForm.newPassword.length < 6) {
              setPassError("A senha deve ter pelo menos 6 caracteres.");
              return;
            }
            if (passForm.newPassword !== passForm.confirm) {
              setPassError("As senhas não coincidem.");
              return;
            }
            setPassSaving(true);
            try {
              await changePassword(passForm.newPassword);
              setPassForm({ newPassword: "", confirm: "" });
              setPassMsg("Senha alterada com sucesso.");
            } catch (err) {
              setPassError((err as Error).message ?? "Erro ao alterar a senha.");
            } finally {
              setPassSaving(false);
            }
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Nova senha</label>
              <input
                type="password"
                className="input"
                value={passForm.newPassword}
                onChange={(e) => setPassForm({ ...passForm, newPassword: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Confirmar nova senha</label>
              <input
                type="password"
                className="input"
                value={passForm.confirm}
                onChange={(e) => setPassForm({ ...passForm, confirm: e.target.value })}
              />
            </div>
          </div>
          {passError && <p className="text-sm text-red-600">{passError}</p>}
          {passMsg && <p className="text-sm text-green-600">{passMsg}</p>}
          <div className="flex items-center gap-3">
            <button type="submit" className="btn-primary" disabled={passSaving}>
              {passSaving ? "Salvando..." : "Alterar senha"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
