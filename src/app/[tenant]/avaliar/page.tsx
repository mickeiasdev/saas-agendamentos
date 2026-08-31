"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Página pública de avaliação pós-atendimento (Fase 2.16).
 * A empresa compartilha o link: /{tenant}/avaliar?codigo=<id do agendamento>
 * A submissão passa pela API route com Admin SDK (valida atendimento concluído).
 */
export default function ReviewPage({
  params,
  searchParams,
}: {
  params: { tenant: string };
  searchParams: { codigo?: string };
}) {
  const slug = params.tenant;
  const { codigo } = searchParams;
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!codigo) setError("Código do atendimento não informado.");
  }, [codigo]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug: slug,
          appointmentId: codigo,
          rating,
          comment: comment || undefined,
          name: name || undefined,
          phone: phone || undefined,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Não foi possível enviar a avaliação.");
      }
      setDone(true);
    } catch (err) {
      setError((err as Error).message ?? "Não foi possível enviar a avaliação.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        {done ? (
          <div className="card text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl font-bold text-emerald-600">
              OK
            </div>
            <h1 className="mt-4 text-xl font-bold text-slate-900">Obrigado pela avaliação!</h1>
            <p className="mt-2 text-sm text-slate-500">
              Sua opinião ajuda a melhorar o atendimento.
            </p>
            <div className="mt-6">
              <Link href={`/${slug}`} className="btn-secondary">
                Voltar ao site
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card space-y-5">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Como foi o atendimento?</h1>
              <p className="mt-1 text-sm text-slate-500">
                Avalie de 1 a 5 estrelas e deixe um comentário.
              </p>
            </div>

            <div>
              <label className="label">Sua nota</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    className={`text-3xl transition-colors ${
                      n <= rating ? "text-amber-500" : "text-slate-300 hover:text-amber-300"
                    }`}
                    aria-label={`${n} estrelas`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Comentário</label>
              <textarea
                className="input"
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="O que achou do serviço?"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Seu nome</label>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
              <div>
                <label className="label">WhatsApp</label>
                <input
                  className="input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button type="submit" className="btn-primary w-full" disabled={submitting || !codigo}>
              {submitting ? "Enviando..." : "Enviar avaliação"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
