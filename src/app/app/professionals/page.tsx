"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenant } from "@/lib/tenant/TenantContext";
import {
  createProfessional,
  listProfessionals,
  removeProfessional,
  updateProfessional,
  type CreateProfessionalInput,
} from "@/lib/repository/professionals";
import { listServices } from "@/lib/repository/services";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { ImageUpload } from "@/components/ui/ImageUpload";
import type { Professional, Service } from "@/types";

const COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

const EMPTY_FORM: CreateProfessionalInput = {
  name: "",
  photoUrl: "",
  description: "",
  phone: "",
  email: "",
  color: COLORS[0],
  active: true,
  serviceIds: [],
};

export default function ProfessionalsPage() {
  const { activeTenantId } = useTenant();
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Professional | null>(null);
  const [form, setForm] = useState<CreateProfessionalInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!activeTenantId) return;
    const [pros, svcs] = await Promise.all([
      listProfessionals(activeTenantId),
      listServices(activeTenantId),
    ]);
    setProfessionals(pros);
    setServices(svcs);
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

  function openEdit(p: Professional) {
    setEditing(p);
    setForm({
      name: p.name,
      photoUrl: p.photoUrl ?? "",
      description: p.description ?? "",
      phone: p.phone ?? "",
      email: p.email ?? "",
      color: p.color,
      active: p.active,
      serviceIds: p.serviceIds,
    });
    setModalOpen(true);
  }

  function toggleService(serviceId: string) {
    setForm((f) => ({
      ...f,
      serviceIds: f.serviceIds.includes(serviceId)
        ? f.serviceIds.filter((s) => s !== serviceId)
        : [...f.serviceIds, serviceId],
    }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTenantId) return;
    setError("");
    setSaving(true);
    try {
      if (editing) {
        await updateProfessional(activeTenantId, editing.id, form);
      } else {
        await createProfessional(activeTenantId, form);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError((err as Error).message ?? "Erro ao salvar profissional.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p: Professional) {
    if (!activeTenantId) return;
    if (!confirm(`Excluir o profissional "${p.name}"?`)) return;
    await removeProfessional(activeTenantId, p.id);
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Profissionais</h1>
          <p className="text-sm text-slate-500">
            Equipe que executa os serviços. Configure a disponibilidade na aba específica.
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          Novo profissional
        </button>
      </div>

      {!loading && professionals.length === 0 ? (
        <EmptyState
          title="Nenhum profissional"
          description="Adicione quem atende no seu negócio."
          action={
            <button onClick={openCreate} className="btn-primary">
              Criar profissional
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {professionals.map((p) => (
            <div key={p.id} className="card">
              <div className="flex items-center gap-3">
                {p.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.photoUrl}
                    alt={p.name}
                    className="h-11 w-11 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-900">{p.name}</div>
                  <div className="text-xs text-slate-500">{p.serviceIds.length} serviços vinculados</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span
                  className={`badge ${
                    p.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {p.active ? "Ativo" : "Inativo"}
                </span>
                <div className="flex gap-3">
                  <button onClick={() => openEdit(p)} className="text-sm text-brand-600 hover:underline">
                    Editar
                  </button>
                  <button onClick={() => handleDelete(p)} className="text-sm text-red-600 hover:underline">
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar profissional" : "Novo profissional"}
      >
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Telefone</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="label">E-mail</label>
              <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
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
              kind="professionals"
              label="Foto do profissional"
              round
              value={form.photoUrl}
              onChange={(url) => setForm({ ...form, photoUrl: url })}
            />
          )}
          <div>
            <label className="label">Cor</label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className={`h-8 w-8 rounded-full ${form.color === c ? "ring-2 ring-offset-2 ring-slate-900" : ""}`}
                  style={{ backgroundColor: c }}
                  aria-label={`Cor ${c}`}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="label">Serviços executados</label>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {services.length === 0 && (
                <p className="text-sm text-slate-500">Nenhum serviço cadastrado ainda.</p>
              )}
              {services.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.serviceIds.includes(s.id)}
                    onChange={() => toggleService(s.id)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600"
                  />
                  {s.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-brand-600"
              />
              Ativo
            </label>
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
