"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenant } from "@/lib/tenant/TenantContext";
import {
  createService,
  listServices,
  removeService,
  updateService,
  type CreateServiceInput,
} from "@/lib/repository/services";
import { listCategories } from "@/lib/repository/categories";
import { listProfessionals } from "@/lib/repository/professionals";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { formatBRL } from "@/lib/utils/format";
import type { Professional, Service } from "@/types";

const EMPTY_FORM: CreateServiceInput = {
  name: "",
  description: "",
  imageUrl: "",
  price: 0,
  durationMinutes: 30,
  categoryId: "",
  status: "active",
  requiresProfessional: true,
  commissionPercent: 0,
  professionals: [],
};

export default function ServicesPage() {
  const { activeTenantId } = useTenant();
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState<CreateServiceInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!activeTenantId) return;
    const [svc, cats, pros] = await Promise.all([
      listServices(activeTenantId),
      listCategories(activeTenantId),
      listProfessionals(activeTenantId),
    ]);
    setServices(svc);
    setCategories(cats.map((c) => ({ id: c.id, name: c.name })));
    setProfessionals(pros);
    setLoading(false);
  }, [activeTenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(s: Service) {
    setEditing(s);
    setForm({
      name: s.name,
      description: s.description ?? "",
      imageUrl: s.imageUrl ?? "",
      price: s.price,
      durationMinutes: s.durationMinutes,
      categoryId: s.categoryId ?? "",
      status: s.status,
      requiresProfessional: s.requiresProfessional,
      commissionPercent: s.commissionPercent,
      professionals: s.professionals ?? [],
    });
    setModalOpen(true);
  }

  function toggleProfessional(professionalId: string) {
    setForm((f) => ({
      ...f,
      professionals: f.professionals!.includes(professionalId)
        ? f.professionals!.filter((id) => id !== professionalId)
        : [...f.professionals!, professionalId],
    }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTenantId) return;
    setError("");
    setSaving(true);
    try {
      if (editing) {
        await updateService(activeTenantId, editing.id, form);
      } else {
        await createService(activeTenantId, form);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError((err as Error).message ?? "Erro ao salvar serviço.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(s: Service) {
    if (!activeTenantId) return;
    if (!confirm(`Excluir o serviço "${s.name}"?`)) return;
    await removeService(activeTenantId, s.id);
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Serviços</h1>
          <p className="text-sm text-slate-500">Gerencie o catálogo de serviços oferecidos.</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          Novo serviço
        </button>
      </div>

      {!loading && services.length === 0 ? (
        <EmptyState
          title="Nenhum serviço cadastrado"
          description="Cadastre o primeiro serviço do seu negócio."
          action={
            <button onClick={openCreate} className="btn-primary">
              Criar serviço
            </button>
          }
        />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Duração</th>
                <th className="px-4 py-3">Preço</th>
                <th className="px-4 py-3">Profissionais</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {services.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {s.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.imageUrl}
                          alt=""
                          className="h-10 w-10 rounded-lg object-cover"
                          referrerPolicy="no-referrer"
                        />
                      )}
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-900">{s.name}</div>
                        {s.description && (
                          <div className="max-w-[240px] truncate text-xs text-slate-500">{s.description}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {categories.find((c) => c.id === s.categoryId)?.name ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{s.durationMinutes} min</td>
                  <td className="px-4 py-3 text-slate-900">{formatBRL(s.price)}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {(s.professionals ?? []).length === 0
                      ? "-"
                      : s.professionals!.map((pid) => professionals.find((p) => p.id === pid)?.name ?? pid).join(", ")}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`badge ${
                        s.status === "active"
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {s.status === "active" ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(s)} className="text-sm text-brand-600 hover:underline">
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(s)}
                      className="ml-3 text-sm text-red-600 hover:underline"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar serviço" : "Novo serviço"}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Nome *</label>
            <input
              required
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Descrição</label>
            <textarea
              className="input"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          {activeTenantId && (
            <ImageUpload
              tenantId={activeTenantId}
              kind="services"
              label="Imagem do serviço"
              value={form.imageUrl}
              onChange={(url) => setForm({ ...form, imageUrl: url })}
            />
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Preço (R$) *</label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                className="input"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Duração (min) *</label>
              <input
                required
                type="number"
                min="5"
                step="5"
                className="input"
                value={form.durationMinutes}
                onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Categoria</label>
              <select
                className="input"
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              >
                <option value="">Sem categoria</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Comissão (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                className="input"
                value={form.commissionPercent}
                onChange={(e) => setForm({ ...form, commissionPercent: Number(e.target.value) })}
              />
            </div>
          </div>
          <div>
            <label className="label">Status</label>
            <select
              className="input"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as "active" | "inactive" })}
            >
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
          </div>
          <div>
            <label className="label">Profissionais que realizam este serviço</label>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {professionals.length === 0 && (
                <p className="text-sm text-slate-500">Nenhum profissional cadastrado ainda.</p>
              )}
              {professionals.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.professionals!.includes(p.id)}
                    onChange={() => toggleProfessional(p.id)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600"
                  />
                  {p.name}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Os vínculos são sincronizados com o cadastro de profissionais automaticamente.
            </p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
