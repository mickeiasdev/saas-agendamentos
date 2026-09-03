"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenant } from "@/lib/tenant/TenantContext";
import {
  createCategory,
  listCategories,
  removeCategory,
  updateCategory,
} from "@/lib/repository/categories";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Category } from "@/types";

export default function CategoriesPage() {
  const { activeTenantId } = useTenant();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!activeTenantId) return;
    const list = await listCategories(activeTenantId);
    setCategories(list);
    setLoading(false);
  }, [activeTenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setName("");
    setDescription("");
    setModalOpen(true);
  }

  function openEdit(c: Category) {
    setEditing(c);
    setName(c.name);
    setDescription(c.description ?? "");
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTenantId) return;
    setError("");
    setSaving(true);
    try {
      if (editing) {
        await updateCategory(activeTenantId, editing.id, { name, description });
      } else {
        await createCategory(activeTenantId, { name, description, status: "active" });
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError((err as Error).message ?? "Erro ao salvar categoria.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: Category) {
    if (!activeTenantId) return;
    if (!confirm(`Excluir a categoria "${c.name}"?`)) return;
    await removeCategory(activeTenantId, c.id);
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Categorias</h1>
          <p className="text-sm text-slate-500">Organize seus serviços em categorias.</p>
        </div>
        <button onClick={openCreate} data-testid="category-create" className="btn-primary">
          Nova categoria
        </button>
      </div>

      {!loading && categories.length === 0 ? (
        <EmptyState
          title="Nenhuma categoria"
          description="Crie categorias para organizar os serviços (ex: Cabelo, Barba, Estética)."
          action={
            <button onClick={openCreate} className="btn-primary">
              Criar categoria
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <div key={c.id} className="card flex items-start justify-between">
              <div>
                <div className="font-semibold text-slate-900">{c.name}</div>
                {c.description && (
                  <p className="mt-1 text-sm text-slate-500">{c.description}</p>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={() => openEdit(c)} className="text-sm text-brand-600 hover:underline">
                  Editar
                </button>
                <button onClick={() => handleDelete(c)} className="text-sm text-red-600 hover:underline">
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar categoria" : "Nova categoria"}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Nome *</label>
            <input
              required
              data-testid="category-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Descrição</label>
            <textarea
              className="input"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" data-testid="category-save" className="btn-primary" disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
