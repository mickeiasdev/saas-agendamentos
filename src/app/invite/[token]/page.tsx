"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { ROLE_NAMES } from "@/lib/rbac/roles";
import FirebaseSetupGuide from "@/components/FirebaseSetupGuide";
import type { Role } from "@/types";

interface InviteView {
  tenantName: string;
  email: string;
  role: Role;
  status: string;
  expired: boolean;
}

export default function AcceptInvitePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const { user, configured, loading: authLoading } = useAuth();
  const router = useRouter();
  const [invite, setInvite] = useState<InviteView | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!token) return;
    void fetch(`/api/app/invites/${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Convite inválido.");
        setInvite(data);
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [token]);

  async function accept() {
    if (!user) {
      router.push(`/login?next=/invite/${token}`);
      return;
    }
    setAccepting(true);
    setError("");
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/app/invites/${token}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível aceitar.");
      router.push("/app");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAccepting(false);
    }
  }

  if (!configured) return <FirebaseSetupGuide />;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md card space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Convite para a equipe</h1>
        {loading || authLoading ? (
          <p className="text-sm text-slate-500">Carregando convite...</p>
        ) : invite ? (
          <>
            <p className="text-sm text-slate-600">
              <strong>{invite.tenantName}</strong> convidou <strong>{invite.email}</strong> como{" "}
              <strong>{ROLE_NAMES[invite.role] ?? invite.role}</strong>.
            </p>
            {invite.expired || invite.status !== "pending" ? (
              <p className="text-sm text-red-600">
                {invite.expired ? "Este convite expirou." : "Este convite não está mais pendente."}
              </p>
            ) : (
              <button type="button" className="btn-primary w-full" onClick={() => void accept()} disabled={accepting}>
                {user ? (accepting ? "Aceitando..." : "Aceitar convite") : "Entrar para aceitar"}
              </button>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-600">Convite não encontrado.</p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <p className="text-center text-sm text-slate-500">
          Não tem conta?{" "}
          <Link href={`/signup?next=/invite/${token}`} className="text-brand-600 hover:underline">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
}
