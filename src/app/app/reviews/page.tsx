"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenant } from "@/lib/tenant/TenantContext";
import { createReview, deleteReview, listReviews } from "@/lib/repository/reviews";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/utils/format";
import type { Review } from "@/types";

export default function ReviewsPage() {
  const { activeTenantId } = useTenant();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!activeTenantId) return;
    const list = await listReviews(activeTenantId);
    setReviews(list);
    setLoading(false);
  }, [activeTenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTenantId) return;
    setError("");
    setSaving(true);
    try {
      await createReview(activeTenantId, { rating, comment: comment || undefined });
      setModalOpen(false);
      setComment("");
      setRating(5);
      await load();
    } catch (err) {
      setError((err as Error).message ?? "Erro ao salvar a avaliação.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Avaliações</h1>
          <p className="text-sm text-slate-500">
            Avaliações dos clientes sobre os atendimentos.
          </p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary">
          Nova avaliação
        </button>
      </div>

      {!loading && reviews.length === 0 ? (
        <EmptyState
          title="Nenhuma avaliação"
          description="As avaliações dos clientes aparecerão aqui."
          action={
            <button onClick={() => setModalOpen(true)} className="btn-primary">
              Nova avaliação
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((r) => (
            <div key={r.id} className="card">
              <div className="flex items-center justify-between">
                <div className="text-amber-500">
                  {"★".repeat(Math.max(0, Math.min(5, r.rating)))}
                  <span className="text-slate-300">
                    {"★".repeat(Math.max(0, 5 - Math.min(5, r.rating)))}
                  </span>
                </div>
                <span className="text-xs text-slate-400">{formatDateTime(r.createdAt)}</span>
              </div>
              {r.comment && <p className="mt-2 text-sm text-slate-600">{r.comment}</p>}
              <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                <span>Cliente: {r.customerId?.slice(0, 8) ?? "—"}</span>
                <button
                  className="text-red-600 hover:underline"
                  onClick={async () => {
                    if (!activeTenantId) return;
                    if (window.confirm("Excluir esta avaliação?")) {
                      await deleteReview(activeTenantId, r.id);
                      await load();
                    }
                  }}
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nova avaliação">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nota</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className={`text-2xl transition-colors ${n <= rating ? "text-amber-500" : "text-slate-300"}`}
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
              placeholder="Como foi o atendimento?"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Salvando..." : "Salvar avaliação"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
