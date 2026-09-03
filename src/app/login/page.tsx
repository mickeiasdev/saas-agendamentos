"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { validateLogin } from "@/lib/auth/validation";
import FirebaseSetupGuide from "@/components/FirebaseSetupGuide";

function LoginForm() {
  const { login, configured } = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const rawNext = search.get("next") ?? "";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/app";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!configured) return <FirebaseSetupGuide />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const invalid = validateLogin({ email, password });
    if (invalid) {
      setError(invalid);
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      router.push(next.startsWith("/") ? next : "/app");
    } catch (err) {
      setError((err as Error).message ?? "Erro ao entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-900">Agenda SaaS</h1>
          <p className="mt-1 text-sm text-slate-500">Entre na sua conta</p>
        </div>
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="label" htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              required
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
        <div className="mt-4 flex items-center justify-between text-sm">
          <Link href="/recover" className="text-brand-600 hover:underline">
            Esqueci minha senha
          </Link>
          <Link href={next !== "/app" ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="text-brand-600 hover:underline">
            Criar conta
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-slate-500">Carregando...</div>}>
      <LoginForm />
    </Suspense>
  );
}
