# Agenda SaaS

Plataforma **SaaS multi-tenant de agendamentos**, construída em **3 fases** sobre um único produto.

O sistema permite que empresas contratem e criem seu próprio ambiente com site público,
agenda inteligente, clientes, serviços, profissionais, categorias, disponibilidade e muito mais —
tudo com **custo inicial próximo de R$ 0**, usando exclusivamente o free tier oficial do **Firebase**.

---

## Regras absolutas do projeto

1. **Custo zero no início**: somente serviços com free tier oficial utilizável. Nada de planos pagos para colocar o MVP no ar.
2. **Firebase é o banco inicial**: Cloud Firestore, Authentication, Storage. Arquitetura preparada para migração futura.
3. **Não gerar código falso**: integrações não ativadas ficam como interfaces + modelos + providers desativados, nunca simuladas.
4. **Isolamento multi-tenant**: regras de segurança no Firestore impedem que um tenant acesse dados de outro.
5. **Uma única plataforma**: as 3 fases são etapas do mesmo produto, não projetos separados.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Frontend | Next.js 14 (App Router), React, TypeScript, Tailwind CSS, PWA |
| Backend | Next.js (API routes) + Firebase Admin SDK (server-only) |
| Banco | Firebase Cloud Firestore (multi-tenant) |
| Autenticação | Firebase Authentication (e-mail/senha; Google opcional) |
| Arquivos | Imagens comprimidas no Firestore (sem Cloud Storage pago) |
| Hosting | Vercel Free ou Firebase Hosting Free |

## Estrutura de pastas

```
├── src/
│   ├── app/                    # Rotas (App Router)
│   │   ├── login|signup|recover
│   │   ├── app/                # Área autenticada (dashboard, serviços, agenda...)
│   │   └── [tenant]/           # Site público + fluxo de agendamento
│   ├── components/             # UI e layout
│   ├── lib/
│   │   ├── firebase/           # Cliente + config
│   │   ├── auth/               # AuthContext
│   │   ├── tenant/             # TenantContext (multi-tenancy)
│   │   ├── rbac/               # Papéis e permissões
│   │   ├── providers/          # Abstrações: Auth, Payment, Email, WhatsApp, Storage, Notification
│   │   ├── repository/         # Camada de dados (Firestore)
│   │   └── availability/       # Motor de geração de horários
│   └── types/                  # Modelos TypeScript
├── firestore.rules             # Regras de segurança
├── firestore.indexes.json      # Índices compostos
├── .env.example                # Variáveis de ambiente (template)
└── .github/workflows/ci.yml    # CI/CD
```

## Começando

Pré-requisitos: Node.js 18+, conta Firebase (plano Spark).

```bash
# 1. Instalar dependências
npm install

# 2. Configurar ambiente
cp .env.example .env.local
#    Preencha as variáveis NEXT_PUBLIC_FIREBASE_* com os dados do seu projeto Firebase

# 3. Rodar em desenvolvimento
npm run dev
```

Ao acessar a aplicação sem Firebase configurado, uma tela orienta a configuração.

> Nenhuma credencial real está (nem deve estar) neste repositório.

## Funcionalidades (Fase 1 — MVP)

- Autenticação: cadastro, login, logout, recuperação e alteração de senha, **Google**
- Multi-tenancy: criação de empresa (tenant) com slug único; vínculo inicial como TENANT_OWNER
- Equipe: convite de papéis (`TENANT_ADMIN`, `MANAGER`, `PROFESSIONAL`, `CUSTOMER`)
- Painel Master (PLATFORM_ADMIN/OWNER): visão geral de empresas e usuários
- CRUDs: categorias, serviços, profissionais, clientes
- Disponibilidade: expediente semanal, intervalos, folgas, bloqueios, férias
- Agenda: visão dia / semana / mês
- Agendamento com **prevenção de double booking** via transação Firestore
- Site público por tenant (`slug.minhaplataforma.com`) com fluxo de agendamento
- Personalização: cor primária, tema, contato/localização no site
- Layout responsivo (sidebar desktop, navegação mobile)
- RBAC: `PLATFORM_OWNER`, `PLATFORM_ADMIN`, `TENANT_OWNER`, `TENANT_ADMIN`, `MANAGER`, `PROFESSIONAL`, `CUSTOMER`
- Segurança: regras Firestore com isolamento de tenant

## Fases

| Fase | Escopo | Status |
| --- | --- | --- |
| **Fase 1** | Fundação + SaaS + agendamento | Implementada (ver funcionalidades acima) |
| **Fase 2** | Monetização, planos, limites, CRM, relatórios, financeiro, cupons, fidelidade, avaliações, SEO, QR Code | Arquitetura preparada (providers/modelos), ativação futura |
| **Fase 3** | Multiunidades, domínio personalizado, PWA, bot WhatsApp, automações, pacotes, estoque, API pública, webhooks, suporte, LGPD, CI/CD | Parcial (PWA, CI/CD, arquitetura); restante preparado para evolução |

## Documentação

| Documento | Conteúdo |
| --- | --- |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Arquitetura, visão multi-tenant e fluxos |
| [DATABASE.md](./DATABASE.md) | Modelo Firestore e coleções |
| [FIREBASE.md](./FIREBASE.md) | Configuração do projeto Firebase |
| [SECURITY.md](./SECURITY.md) | Regras de segurança, RBAC, LGPD |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Deploy gratuito (Vercel/Firebase) |
| [API.md](./API.md) | API pública (fase 3) e webhooks |
| [TESTING.md](./TESTING.md) | Estratégia e comandos de teste |
| [ENVIRONMENT.md](./ENVIRONMENT.md) | Variáveis de ambiente |
| [FREE_TIER.md](./FREE_TIER.md) | Serviços gratuitos, limites e economia |

## Scripts

```bash
npm run dev          # servidor de desenvolvimento
npm run build        # build de produção
npm run lint         # lint (ESLint)
npm run typecheck    # checagem de tipos (tsc)
npm test             # testes unitários (Vitest)
npm run test:rules   # rules reais no emulador Firestore (Tenant A ↛ Tenant B)
npm run test:e2e     # Playwright (Fase 1 + botão Google)
```

## Licença

Projeto privado de uso do proprietário da plataforma.
