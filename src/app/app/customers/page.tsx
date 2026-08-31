"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenant } from "@/lib/tenant/TenantContext";
import {
  deleteCustomer,
  listCustomers,
  upsertCustomer,
  type CreateCustomerInput,
} from "@/lib/repository/customers";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Customer } from "@/types";

const EMPTY_FORM: CreateCustomerInput = {
  name: "",
  email: "",
  phone: "",
  whatsapp: "",
  birthDate: "",
  notes: "",
  tags: [],
};

export default function CustomersPage() {
  const { activeTenantId } = useTenant();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [nextCursor, setNextCursor] = useState<unknown>(null);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<CreateCustomerInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (cursor: unknown = null, searchTerm = search) => {
      if (!activeTenantId) return;
      const page = await listCustomers(activeTenantId, {
        search: searchTerm || undefined,
        pageSize: 20,
        cursor: cursor as never,
      });
      setCustomers((prev) => (cursor ? [...prev, ...page.items] : page.items));
      setNextCursor(page.nextCursor);
      setHasMore(page.nextCursor !== null);
      setLoading(false);
    },
    [activeTenantId, search]
  );

  useEffect(() => {
    setLoading(true);
    void load(null, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTenantId]);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      void load(null, search);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(c: Customer) {
    setEditing(c);
    setForm({
      name: c.name,
      email: c.email ?? "",
      phone: c.phone ?? "",
      whatsapp: c.whatsapp ?? "",
      birthDate: c.birthDate ?? "",
      notes: c.notes ?? "",
      tags: c.tags,
    });
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTenantId) return;
    setError("");
    setSaving(true);
    try {
      await upsertCustomer(activeTenantId, editing?.id, form);
      setModalOpen(false);
      await load(null, search);
    } catch (err) {
      setError((err as Error).message ?? "Erro ao salvar cliente.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: Customer) {
    if (!activeTenantId) return;
    if (!confirm(`Excluir o cliente "${c.name}"?`)) return;
    await deleteCustomer(activeTenantId, c.id);
    await load(null, search);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clientes</h1>
          <p className="text-sm text-slate-500">Base de clientes com histórico e dados de contato.</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          Novo cliente
        </button>
      </div>

      <input
        className="input max-w-md"
        placeholder="Buscar por nome, e-mail ou telefone..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {!loading && customers.length === 0 ? (
        <EmptyState
          title="Nenhum cliente encontrado"
          description="Cadastre clientes manualmente ou eles podem se cadastrar ao agendar pelo site público."
          action={
            <button onClick={openCreate} className="btn-primary">
              Criar cliente
            </button>
          }
        />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Contato</th>
                <th className="px-4 py-3">Visitas</th>
                <th className="px-4 py-3">Total gasto</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.phone || c.whatsapp || c.email || "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.visitCount}</td>
                  <td className="px-4 py-3 text-slate-900">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c.totalSpent)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(c)} className="text-sm text-brand-600 hover:underline">
                      Editar
                    </button>
                    <button onClick={() => handleDelete(c)} className="ml-3 text-sm text-red-600 hover:underline">
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {hasMore && (
            <div className="border-t border-slate-100 p-3 text-center">
              <button onClick={() => void load(nextCursor, search)} className="btn-secondary">
                Carregar mais
              </button>
            </div>
          )}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar cliente" : "Novo cliente"}>
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
              <label className="label">E-mail</label>
              <input
                type="email"
                className="input"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Telefone</label>
              <input
                className="input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">WhatsApp</label>
              <input
                className="input"
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Nascimento</label>
              <input
                type="date"
                className="input"
                value={form.birthDate}
                onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label">Observações</label>
            <textarea
              className="input"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
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
