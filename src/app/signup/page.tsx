"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import FirebaseSetupGuide from "@/components/FirebaseSetupGuide";

function SignupForm() {
  const { register, configured } = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const rawNext = search.get("next") ?? "";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/app?verify=1";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!configured) return <FirebaseSetupGuide />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    try {
      await register(email, password, name);
      router.push(next.startsWith("/") ? next : "/app?verify=1");
    } catch (err) {
      setError((err as Error).message ?? "Erro ao criar conta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-900">Agenda SaaS</h1>
          <p className="mt-1 text-sm text-slate-500">Crie sua conta gratuitamente</p>
        </div>
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="label" htmlFor="name">Nome</label>
            <input id="name" required className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="email">E-mail</label>
            <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="password">Senha</label>
            <input id="password" type="password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="confirm">Confirmar senha</label>
            <input id="confirm" type="password" required className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Criando conta..." : "Criar conta"}
          </button>
        </form>
        <div className="mt-4 text-center text-sm">
          Já tem conta?{" "}
          <Link href={next.startsWith("/invite/") ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="text-brand-600 hover:underline">
            Entrar
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-slate-500">Carregando...</div>}>
      <SignupForm />
    </Suspense>
  );
}
