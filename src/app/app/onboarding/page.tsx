"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { useTenant } from "@/lib/tenant/TenantContext";
import { uploadTenantImage } from "@/lib/storage/upload";
import { slugify } from "@/lib/tenant/slug";

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
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [tradeName, setTradeName] = useState("");
  const [cnpjCpf, setCnpjCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [instagram, setInstagram] = useState("");
  const [description, setDescription] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [segmentId, setSegmentId] = useState("barber");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const platformDomain = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "minhaplataforma.com";
  const previewSlug = slugTouched ? slugify(slug) : slugify(name);

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
        instagram: instagram || undefined,
        description: description || undefined,
        address: {
          street: street || undefined,
          number: number || undefined,
          complement: complement || undefined,
          neighborhood: neighborhood || undefined,
          city: city || undefined,
          state: state || undefined,
          zip: zip || undefined,
        },
        segmentId,
        slug: slugTouched ? slug : name,
      });
      if (logoFile) {
        const logoUrl = await uploadTenantImage(tenantId, "logo", logoFile);
        await updateDoc(doc(getFirebaseFirestore(), "tenants", tenantId), {
          logoUrl,
          updatedAt: serverTimestamp(),
        });
      }
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
      <form onSubmit={handleSubmit} data-testid="onboarding-form" className="card space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="name">Nome da empresa *</label>
            <input
              id="name"
              required
              className="input"
              data-testid="onboarding-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
            />
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
        <div>
          <label className="label" htmlFor="slug">Endereço público *</label>
          <input
            id="slug"
            required
            className="input"
            data-testid="onboarding-slug"
            value={slugTouched ? slug : previewSlug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            placeholder="minha-empresa"
          />
          <p className="mt-1 text-xs text-slate-500">
            Seu site fica em <code className="rounded bg-slate-100 px-1">{previewSlug || "sua-empresa"}.{platformDomain}</code>.
            Duas empresas não podem ter o mesmo endereço.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="instagram">Instagram</label>
          <input id="instagram" className="input" placeholder="@suaempresa" value={instagram} onChange={(e) => setInstagram(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="description">Descrição</label>
          <textarea
            id="description"
            className="input"
            rows={2}
            placeholder="Resumo do seu negócio (aparece no site público)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="logo">Logo da empresa</label>
          <div className="flex items-center gap-3">
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoPreview} alt="" className="h-14 w-14 rounded-lg object-cover" />
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
                —
              </span>
            )}
            <input
              id="logo"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setLogoFile(file);
                setLogoPreview(file ? URL.createObjectURL(file) : "");
              }}
            />
          </div>
          <p className="mt-1 text-xs text-slate-400">A logo é comprimida e salva no Firestore. Sem Cloud Storage pago.</p>
        </div>
        <fieldset className="rounded-lg border border-slate-200 p-4">
          <legend className="px-1 text-sm font-medium text-slate-700">Endereço</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="street">Rua</label>
              <input id="street" className="input" value={street} onChange={(e) => setStreet(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="number">Número</label>
              <input id="number" className="input" value={number} onChange={(e) => setNumber(e.target.value)} />
            </div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="complement">Complemento</label>
              <input id="complement" className="input" value={complement} onChange={(e) => setComplement(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="neighborhood">Bairro</label>
              <input id="neighborhood" className="input" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
            </div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="city">Cidade</label>
              <input id="city" className="input" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="state">Estado</label>
              <input id="state" className="input" maxLength={2} placeholder="SP" value={state} onChange={(e) => setState(e.target.value.toUpperCase())} />
            </div>
            <div>
              <label className="label" htmlFor="zip">CEP</label>
              <input id="zip" className="input" value={zip} onChange={(e) => setZip(e.target.value)} />
            </div>
          </div>
        </fieldset>
        {error && <p data-testid="onboarding-error" className="text-sm text-red-600">{error}</p>}
        <button type="submit" data-testid="onboarding-submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Criando..." : "Criar empresa e começar"}
        </button>
      </form>
    </div>
  );
}
