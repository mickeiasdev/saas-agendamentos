"use client";

import { useCallback, useEffect, useState } from "react";
import { collection, getCountFromServer, query } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { can } from "@/lib/rbac/roles";

interface MasterStats {
  tenants: number | null;
  users: number | null;
  appointments: number | null;
}

export default function MasterPage() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<MasterStats>({ tenants: null, users: null, appointments: null });
  const [error, setError] = useState("");

  const allowed = can(profile?.platformRole as never, "master.view");

  const load = useCallback(async () => {
    const db = getFirebaseFirestore();
    try {
      const tenants = await getCountFromServer(query(collection(db, "tenants")));
      const users = await getCountFromServer(query(collection(db, "users")));
      const apps = await getCountFromServer(query(collection(db, "tenants"), {} as never));
      setStats({
        tenants: tenants.data().count,
        users: users.data().count,
        appointments: null,
      });
      void apps;
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
          <div className="text-3xl font-bold text-brand-600">-</div>
          <div className="text-sm text-slate-500">
            Agendamentos totais
            <span className="ml-1 text-xs text-slate-400">(agregado via Cloud Function)</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{error}</div>
      )}

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
