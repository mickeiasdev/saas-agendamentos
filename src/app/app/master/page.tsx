"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { can } from "@/lib/rbac/roles";
import { Modal } from "@/components/ui/Modal";
import type { MasterTenantRow } from "@/app/api/master/tenants/route";
import type { MasterUserRow } from "@/app/api/master/tenants/[id]/users/route";
import type { MasterActivityRow } from "@/app/api/master/activity/route";
import type { PlatformUserRow } from "@/app/api/master/users/route";

interface MasterStats {
  tenants: number | null;
  users: number | null;
  appointments: number | null;
}

const SEGMENT_LABELS: Record<string, string> = {
  barber: "Barbearia",
  salon: "Salão",
  aesthetics: "Estética",
  clinic: "Clínica",
  dental: "Odontologia",
  personal: "Personal",
  tattoo: "Tatuagem",
  photography: "Fotografia",
  workshop: "Oficina",
  pet: "Pet",
  services: "Serviços",
  other: "Outros",
};

async function authHeaders(token: string | null): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export default function MasterPage() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<MasterStats>({ tenants: null, users: null, appointments: null });
  const [tenants, setTenants] = useState<MasterTenantRow[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [usersOpenFor, setUsersOpenFor] = useState<MasterTenantRow | null>(null);
  const [users, setUsers] = useState<MasterUserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [platformUsers, setPlatformUsers] = useState<PlatformUserRow[]>([]);
  const [activity, setActivity] = useState<MasterActivityRow[]>([]);

  const allowed = can(profile?.platformRole as never, "master.view");
  const isOwner = can(profile?.platformRole as never, "master.manage");

  const load = useCallback(async () => {
    if (!user) return;
    setError("");
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/master/tenants", { headers: await authHeaders(token) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao carregar a plataforma.");
      setStats(data.stats);
      setTenants(data.tenants ?? []);

      const [usersRes, activityRes] = await Promise.all([
        fetch("/api/master/users", { headers: await authHeaders(token) }),
        fetch("/api/master/activity", { headers: await authHeaders(token) }),
      ]);
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setPlatformUsers(usersData.users ?? []);
      }
      if (activityRes.ok) {
        const activityData = await activityRes.json();
        setActivity(activityData.items ?? []);
      }
    } catch (err) {
      setError((err as Error).message || "Não foi possível carregar o painel master.");
    }
  }, [user]);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  async function changeTenantStatus(t: MasterTenantRow, action: "suspend" | "activate" | "pending") {
    if (!user) return;
    setError("");
    setNotice("");
    const label = action === "suspend" ? "suspender" : action === "pending" ? "marcar como pendente" : "reativar";
    if (!confirm(`Deseja ${label} a empresa "${t.tradeName ?? t.name}"?`)) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/master/tenants/${t.id}`, {
        method: "PATCH",
        headers: await authHeaders(token),
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao atualizar a empresa.");
      setNotice(`Empresa "${t.tradeName ?? t.name}" ${label} com sucesso.`);
      await load();
    } catch (err) {
      setError((err as Error).message || "Não foi possível atualizar a empresa.");
    }
  }

  async function openUsers(t: MasterTenantRow) {
    if (!user) return;
    setUsersOpenFor(t);
    setUsersLoading(true);
    setUsers([]);
    setError("");
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/master/tenants/${t.id}/users`, { headers: await authHeaders(token) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao carregar usuários.");
      setUsers(data.users ?? []);
    } catch (err) {
      setError((err as Error).message || "Não foi possível carregar os usuários.");
    } finally {
      setUsersLoading(false);
    }
  }

  async function changeUserStatus(u: MasterUserRow, status: "active" | "disabled") {
    if (!user || !usersOpenFor) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/master/tenants/${usersOpenFor.id}/users/${u.userId}`, {
        method: "PATCH",
        headers: await authHeaders(token),
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao atualizar o usuário.");
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, status } : x)));
    } catch (err) {
      setError((err as Error).message || "Não foi possível atualizar o usuário.");
    }
  }

  if (!allowed) {
    return (
      <div className="card">
        <h1 className="text-xl font-bold text-slate-900">Acesso negado</h1>
        <p className="mt-2 text-sm text-slate-600">
          Este painel é restrito a PLATFORM_OWNER e PLATFORM_ADMIN. O primeiro usuário da plataforma (ou o e-mail em PLATFORM_OWNER_EMAIL) é promovido automaticamente.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Painel Master</h1>
        <p className="text-sm text-slate-500">
          Gestão da plataforma: empresas, usuários e status de cada tenant.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card">
          <div className="text-3xl font-bold text-brand-600">{stats.tenants === null ? "-" : stats.tenants}</div>
          <div className="text-sm text-slate-500">Empresas (tenants)</div>
        </div>
        <div className="card">
          <div className="text-3xl font-bold text-brand-600">{stats.users === null ? "-" : stats.users}</div>
          <div className="text-sm text-slate-500">Usuários</div>
        </div>
        <div className="card">
          <div className="text-3xl font-bold text-brand-600">{stats.appointments === null ? "-" : stats.appointments}</div>
          <div className="text-sm text-slate-500">Agendamentos</div>
        </div>
      </div>

      {error && <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{error}</div>}
      {notice && <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</div>}

      <div className="card overflow-x-auto p-0">
        <div className="border-b border-slate-200 px-5 py-3">
          <h2 className="font-semibold text-slate-900">Empresas cadastradas</h2>
        </div>
        {tenants.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">Nenhuma empresa cadastrada ainda.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Empresa</th>
                <th className="px-5 py-3">Segmento</th>
                <th className="px-5 py-3">Plano</th>
                <th className="px-5 py-3">Usuários</th>
                <th className="px-5 py-3">Agendamentos</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-900">{t.tradeName ?? t.name}</div>
                    <div className="text-xs text-slate-500">/{t.slug}</div>
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {t.segmentId ? SEGMENT_LABELS[t.segmentId] ?? t.segmentId : "-"}
                  </td>
                  <td className="px-5 py-3">
                    <span className="badge bg-slate-100 text-slate-700">{t.planId}</span>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{t.userCount}</td>
                  <td className="px-5 py-3 text-slate-600">{t.appointmentCount}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`badge ${
                        t.status === "suspended"
                          ? "bg-red-100 text-red-700"
                          : t.status === "pending"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => openUsers(t)}
                        className="text-sm text-brand-600 hover:underline"
                      >
                        Usuários
                      </button>
                      {t.status === "suspended" ? (
                        <button
                          onClick={() => changeTenantStatus(t, "activate")}
                          className="text-sm text-green-700 hover:underline"
                        >
                          Reativar
                        </button>
                      ) : (
                        <button
                          onClick={() => changeTenantStatus(t, "suspend")}
                          className="text-sm text-red-600 hover:underline"
                        >
                          Suspender
                        </button>
                      )}
                      {isOwner && t.status === "active" && (
                        <button
                          onClick={() => changeTenantStatus(t, "pending")}
                          className="text-sm text-amber-700 hover:underline"
                        >
                          Pendente
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={usersOpenFor !== null}
        onClose={() => setUsersOpenFor(null)}
        title={`Usuários — ${usersOpenFor?.tradeName ?? usersOpenFor?.name ?? ""}`}
      >
        {usersLoading ? (
          <p className="py-6 text-center text-sm text-slate-500">Carregando usuários...</p>
        ) : users.length === 0 ? (
          <p className="py-6 text-sm text-slate-500">Nenhum usuário vinculado a esta empresa.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {users.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-900">{u.displayName || u.email || u.userId}</div>
                  <div className="text-xs text-slate-500">
                    {u.email ?? u.userId} · {u.role}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`badge ${
                      u.status === "disabled"
                        ? "bg-red-100 text-red-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {u.status === "disabled" ? "Desabilitado" : "Ativo"}
                  </span>
                  <button
                    onClick={() => changeUserStatus(u, u.status === "disabled" ? "active" : "disabled")}
                    className="text-sm text-brand-600 hover:underline"
                  >
                    {u.status === "disabled" ? "Ativar" : "Desabilitar"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <div className="card overflow-x-auto p-0">
        <div className="border-b border-slate-200 px-5 py-3">
          <h2 className="font-semibold text-slate-900">Usuários da plataforma</h2>
        </div>
        {platformUsers.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">Nenhum usuário cadastrado.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Usuário</th>
                <th className="px-5 py-3">Papel</th>
                <th className="px-5 py-3">Empresas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {platformUsers.map((u) => (
                <tr key={u.uid} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-900">{u.displayName || u.email || u.uid}</div>
                    <div className="text-xs text-slate-500">{u.email ?? u.uid}</div>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{u.platformRole ?? "USER"}</td>
                  <td className="px-5 py-3 text-slate-600">
                    {u.memberships.length === 0
                      ? "-"
                      : u.memberships.map((m) => `${m.role} (${m.status})`).join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card overflow-x-auto p-0">
        <div className="border-b border-slate-200 px-5 py-3">
          <h2 className="font-semibold text-slate-900">Feed de atividade</h2>
        </div>
        {activity.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">Nenhuma atividade registrada.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {activity.map((item) => (
              <li key={item.id} className="px-5 py-3 text-sm">
                <div className="font-medium text-slate-900">{item.action}</div>
                <div className="text-xs text-slate-500">
                  {item.tenantId ? `tenant ${item.tenantId}` : "plataforma"}
                  {item.entityType ? ` · ${item.entityType}` : ""}
                  {item.entityId ? ` · ${item.entityId}` : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h2 className="mb-2 font-semibold text-slate-900">Uso da Plataforma</h2>
        <p className="text-sm text-slate-600">
          Métricas de consumo do free tier do Firebase (leituras, escritas, armazenamento,
          funções) podem ser consultadas no console do Firebase. A plataforma não inventa
          números: métricas que exigem API externa paga são exibidas como indisponíveis.
        </p>
        <ul className="mt-3 space-y-1 text-sm text-slate-600">
          <li>- Firebase Usage & Billing: relatório oficial de consumo.</li>
          <li>- Alertas de limite: defina orçamentos no console Firebase (Spark não cobra).</li>
        </ul>
      </div>
    </div>
  );
}
