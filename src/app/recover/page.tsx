"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { validateRecover } from "@/lib/auth/validation";
import FirebaseSetupGuide from "@/components/FirebaseSetupGuide";

export default function RecoverPage() {
  const { resetPassword, configured } = useAuth();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!configured) return <FirebaseSetupGuide />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    const invalid = validateRecover(email);
    if (invalid) {
      setError(invalid);
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email);
      setMessage("Enviamos um link de recuperação para o seu e-mail.");
    } catch (err) {
      setError((err as Error).message ?? "Erro ao enviar link.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-900">Recuperar senha</h1>
          <p className="mt-1 text-sm text-slate-500">Informe seu e-mail para receber o link</p>
        </div>
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="label" htmlFor="email">E-mail</label>
            <input id="email" type="email" required data-testid="recover-email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {message && <p data-testid="recover-success" className="text-sm text-green-600">{message}</p>}
          {error && <p data-testid="recover-error" className="text-sm text-red-600">{error}</p>}
          <button type="submit" data-testid="recover-submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Enviando..." : "Enviar link"}
          </button>
        </form>
        <div className="mt-4 text-center text-sm">
          <Link href="/login" className="text-brand-600 hover:underline">
            Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  );
}
