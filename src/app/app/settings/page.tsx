"use client";

import { useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { useTenant } from "@/lib/tenant/TenantContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { can } from "@/lib/rbac/roles";
import { getRoleForTenant } from "@/lib/rbac/membership";

export default function SettingsPage() {
  const { activeTenant, activeTenantId, memberships, refreshActiveTenant } = useTenant();
  const { user, changePassword, verifyEmail } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    primaryColor: activeTenant?.branding.primaryColor ?? "#4f46e5",
    theme: activeTenant?.branding.theme ?? ("light" as "light" | "dark"),
    showContact: activeTenant?.branding.showContact ?? true,
    showLocation: activeTenant?.branding.showLocation ?? true,
  });
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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setSaving(true);
    setSaved(false);
    try {
      const db = getFirebaseFirestore();
      await updateDoc(doc(db, "tenants", tenantId), {
        branding: {
          ...tenant.branding,
          primaryColor: form.primaryColor,
          theme: form.theme,
          showContact: form.showContact,
          showLocation: form.showLocation,
        },
        updatedAt: serverTimestamp(),
      });
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
        <p className="text-sm text-slate-500">Personalização, site público e dados da empresa.</p>
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

      <form onSubmit={handleSave} className="card space-y-4">
        <h2 className="font-semibold text-slate-900">Personalização</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Cor principal</label>
            <input
              type="color"
              className="h-11 w-full cursor-pointer rounded-lg border border-slate-300"
              value={form.primaryColor}
              disabled={!canManage}
              onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Tema</label>
            <select
              className="input"
              value={form.theme}
              disabled={!canManage}
              onChange={(e) => setForm({ ...form, theme: e.target.value as "light" | "dark" })}
            >
              <option value="light">Claro</option>
              <option value="dark">Escuro</option>
            </select>
          </div>
        </div>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand-600"
              checked={form.showContact}
              disabled={!canManage}
              onChange={(e) => setForm({ ...form, showContact: e.target.checked })}
            />
            Mostrar contato no site
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand-600"
              checked={form.showLocation}
              disabled={!canManage}
              onChange={(e) => setForm({ ...form, showLocation: e.target.checked })}
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
      </form>

      <div className="card">
        <h2 className="mb-3 font-semibold text-slate-900">Dados da empresa</h2>        <dl className="grid gap-3 text-sm sm:grid-cols-2">
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
