import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-lg font-bold text-white">
              A
            </span>
            <span className="text-lg font-bold text-slate-900">Agenda SaaS</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Entrar
            </Link>
            <Link href="/signup" className="btn-primary">
              Criar conta grátis
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="bg-gradient-to-b from-brand-50 to-white py-20">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              Agendamentos para o seu negócio em um único lugar
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
              Plataforma SaaS multi-tenant: site público, agenda inteligente, clientes,
              serviços, profissionais e muito mais — sem precisar de servidores.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link href="/signup" className="btn-primary px-6 py-3 text-base">
                Começar agora
              </Link>
              <Link href="/login" className="btn-secondary px-6 py-3 text-base">
                Já tenho conta
              </Link>
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  title: "Site público",
                  desc: "Cada empresa tem seu próprio endereço (suaempresa.minhaplataforma.com) com serviços, profissionais e botão de agendamento.",
                },
                {
                  title: "Agenda inteligente",
                  desc: "Vista por dia, semana ou mês, com prevenção de horários duplicados e regras de disponibilidade dos profissionais.",
                },
                {
                  title: "Clientes e CRM",
                  desc: "Cadastro, histórico de visitas, gasto total e tags para conhecer cada cliente do seu negócio.",
                },
                {
                  title: "Serviços e categorias",
                  desc: "Organize o catálogo com preço, duração, comissão e imagem.",
                },
                {
                  title: "Profissionais",
                  desc: "Equipe com horários de atendimento, folgas, férias e feriados.",
                },
                {
                  title: "Custo zero no início",
                  desc: "Construído sobre o free tier oficial do Firebase. Sem cartão, sem custo obrigatório para colocar o MVP no ar.",
                },
              ].map((f) => (
                <div key={f.title} className="card">
                  <h3 className="text-lg font-semibold text-slate-900">{f.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-slate-500">
          © {new Date().getFullYear()} Agenda SaaS — Plataforma multi-tenant de agendamentos.
        </div>
      </footer>
    </div>
  );
}
