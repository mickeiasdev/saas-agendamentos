"use client";

import { useCallback, useEffect, useState } from "react";
import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { can } from "@/lib/rbac/roles";
import type { Tenant } from "@/types";

interface MasterStats {
  tenants: number | null;
  users: number | null;
  appointments: number | null;
}

export default function MasterPage() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<MasterStats>({ tenants: null, users: null, appointments: null });
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [error, setError] = useState("");

  const allowed = can(profile?.platformRole as never, "master.view");

  const load = useCallback(async () => {
    const db = getFirebaseFirestore();
    try {
      const tenantsSnap = await getDocs(
        query(collection(db, "tenants"), orderBy("createdAt", "desc"), limit(50))
      );
      const tenantDocs = tenantsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Tenant);
      setTenants(tenantDocs);

      const usersCount = await getCountFromServer(query(collection(db, "users")));
      const tenantsCount = await getCountFromServer(query(collection(db, "tenants")));

      let appointments = 0;
      for (const t of tenantDocs) {
        const snap = await getCountFromServer(
          query(collection(db, "tenants", t.id, "appointments"))
        );
        appointments += snap.data().count;
      }

      setStats({
        tenants: tenantsCount.data().count,
        users: usersCount.data().count,
        appointments,
      });
      setError("");
    } catch (err) {
      setError("Não foi possível carregar as métricas. Verifique as regras de segurança do Firestore.");
    }
  }, []);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  if (!allowed) {
    return (
      <div className="card">
        <h1 className="text-xl font-bold text-slate-900">Acesso negado</h1>
        <p className="mt-2 text-sm text-slate-600">
          Este painel é restrito a administradores da plataforma.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Painel Master</h1>
        <p className="text-sm text-slate-500">Visão geral da plataforma e uso estimado.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card">
          <div className="text-3xl font-bold text-brand-600">
            {stats.tenants === null ? "-" : stats.tenants}
          </div>
          <div className="text-sm text-slate-500">Empresas (tenants)</div>
        </div>
        <div className="card">
          <div className="text-3xl font-bold text-brand-600">
            {stats.users === null ? "-" : stats.users}
          </div>
          <div className="text-sm text-slate-500">Usuários</div>
        </div>
        <div className="card">
          <div className="text-3xl font-bold text-brand-600">
            {stats.appointments === null ? "-" : stats.appointments}
          </div>
          <div className="text-sm text-slate-500">Agendamentos</div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{error}</div>
      )}

      <div className="card overflow-x-auto p-0">
        <div className="border-b border-slate-200 px-5 py-3">
          <h2 className="font-semibold text-slate-900">Empresas cadastradas</h2>
        </div>
        {tenants.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">
            Nenhuma empresa cadastrada ainda.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Empresa</th>
                <th className="px-5 py-3">Segmento</th>
                <th className="px-5 py-3">Plano</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-900">
                      {t.tradeName ?? t.name}
                    </div>
                    <div className="text-xs text-slate-500">/{t.slug}</div>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{t.segmentId ?? "-"}</td>
                  <td className="px-5 py-3">
                    <span className="badge bg-slate-100 text-slate-700">{t.planId}</span>
                  </td>
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
                </tr>
              ))}
            </tbody>
          </table>
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
