"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTenant } from "@/lib/tenant/TenantContext";

const SEGMENTS = [
  { id: "barber", label: "Barbearia" },
  { id: "salon", label: "Salão" },
  { id: "aesthetics", label: "Estética" },
  { id: "clinic", label: "Clínica" },
  { id: "dental", label: "Odontologia" },
  { id: "personal", label: "Personal" },
  { id: "tattoo", label: "Tatuagem" },
  { id: "photography", label: "Fotografia" },
  { id: "workshop", label: "Oficina" },
  { id: "pet", label: "Pet" },
  { id: "services", label: "Serviços" },
  { id: "other", label: "Outros" },
];

export default function OnboardingPage() {
  const { createTenant } = useTenant();
  const router = useRouter();
  const [name, setName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [cnpjCpf, setCnpjCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [segmentId, setSegmentId] = useState("barber");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const tenantId = await createTenant({
        name,
        tradeName: tradeName || undefined,
        cnpjCpf: cnpjCpf || undefined,
        phone: phone || undefined,
        whatsapp: whatsapp || undefined,
        email: email || undefined,
        segmentId,
        slug: name,
      });
      void tenantId;
      router.push("/app");
    } catch (err) {
      setError((err as Error).message ?? "Erro ao criar a empresa.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Crie sua empresa</h1>
        <p className="mt-1 text-sm text-slate-500">
          Seu ambiente SaaS com site público, agenda, clientes e muito mais.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="card space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="name">Nome da empresa *</label>
            <input id="name" required className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="tradeName">Nome fantasia</label>
            <input id="tradeName" className="input" value={tradeName} onChange={(e) => setTradeName(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="cnpj">CPF/CNPJ</label>
            <input id="cnpj" className="input" value={cnpjCpf} onChange={(e) => setCnpjCpf(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="phone">Telefone</label>
            <input id="phone" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="whatsapp">WhatsApp</label>
            <input id="whatsapp" className="input" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="email">E-mail de contato</label>
            <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="segment">Segmento</label>
            <select id="segment" className="input" value={segmentId} onChange={(e) => setSegmentId(e.target.value)}>
              {SEGMENTS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Criando..." : "Criar empresa e começar"}
        </button>
      </form>
    </div>
  );
}
