"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useTenant } from "@/lib/tenant/TenantContext";
import { can, ROLE_NAMES, TENANT_INVITE_ROLES } from "@/lib/rbac/roles";
import { canInviteRole } from "@/lib/invites";
import { getRoleForTenant } from "@/lib/rbac/membership";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Role } from "@/types";

interface TeamMember {
  id: string;
  userId: string;
  role: Role;
  status: string;
  displayName?: string;
  email?: string;
}

interface TeamInvite {
  id: string;
  email: string;
  role: Role;
  status: string;
}

export default function TeamPage() {
  const { user } = useAuth();
  const { activeTenant, activeTenantId, memberships } = useTenant();
  const role = activeTenantId ? getRoleForTenant(memberships, activeTenantId)?.role : undefined;
  const canManage = can(role, "team.manage");
  const inviteRoles = TENANT_INVITE_ROLES.filter((r) => (role ? canInviteRole(role, r) : false));

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("MANAGER");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [lastLink, setLastLink] = useState("");

  const load = useCallback(async () => {
    if (!user || !activeTenantId || !canManage) {
      setLoading(false);
      return;
    }
    setError("");
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/app/tenants/${activeTenantId}/invites`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao carregar a equipe.");
      setMembers(data.members ?? []);
      setInvites(data.invites ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user, activeTenantId, canManage]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !activeTenantId) return;
    setSaving(true);
    setError("");
    setNotice("");
    setLastLink("");
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/app/tenants/${activeTenantId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao enviar convite.");
      const link = `${window.location.origin}/invite/${data.token}`;
      setLastLink(link);
      setNotice(`Convite enviado para ${data.email} como ${data.roleLabel}.`);
      setEmail("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function revoke(tokenId: string) {
    if (!user || !activeTenantId) return;
    if (!confirm("Revogar este convite?")) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/app/tenants/${activeTenantId}/invites/${tokenId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao revogar.");
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!canManage) {
    return (
      <div className="card">
        <h1 className="text-xl font-bold text-slate-900">Equipe</h1>
        <p className="mt-2 text-sm text-slate-600">Somente administradores da empresa podem convidar papéis.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Equipe</h1>
        <p className="text-sm text-slate-500">
          Convide administradores, gerentes, profissionais e clientes para {activeTenant?.name ?? "sua empresa"}.
          O cadastro da empresa continua nascendo como dono (TENANT_OWNER).
        </p>
      </div>

      <form onSubmit={handleInvite} className="card space-y-4">
        <h2 className="font-semibold text-slate-900">Convidar por e-mail</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="invite-email">E-mail</label>
            <input
              id="invite-email"
              type="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="pessoa@empresa.com"
            />
          </div>
          <div>
            <label className="label" htmlFor="invite-role">Papel</label>
            <select id="invite-role" className="input" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
              {inviteRoles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_NAMES[r]}
                </option>
              ))}
            </select>
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {notice && <p className="text-sm text-emerald-700">{notice}</p>}
        {lastLink && (
          <p className="break-all rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            Link do convite: {lastLink}
          </p>
        )}
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Enviando..." : "Enviar convite"}
        </button>
      </form>

      <div className="card">
        <h2 className="mb-3 font-semibold text-slate-900">Membros</h2>
        {loading ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : members.length === 0 ? (
          <EmptyState title="Nenhum membro" description="Ainda não há pessoas nesta empresa." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <div className="font-medium text-slate-900">{m.displayName || m.email || m.userId}</div>
                  <div className="text-slate-500">{m.email}</div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-slate-700">{ROLE_NAMES[m.role] ?? m.role}</div>
                  <div className="text-xs text-slate-400">{m.status}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold text-slate-900">Convites pendentes</h2>
        {invites.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum convite pendente.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {invites.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <div className="font-medium text-slate-900">{inv.email}</div>
                  <div className="text-slate-500">{ROLE_NAMES[inv.role] ?? inv.role}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">{inv.status}</span>
                  {inv.status === "pending" && (
                    <button type="button" className="btn-secondary py-1 text-xs" onClick={() => void revoke(inv.id)}>
                      Revogar
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
