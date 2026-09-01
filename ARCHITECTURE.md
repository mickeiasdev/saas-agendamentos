# Arquitetura

## Visão geral

```
                    MINHA PLATAFORMA
                           │
                    Firebase Backend
                           │
              ┌────────────┼────────────┐
              │            │            │
          EMPRESA A    EMPRESA B    EMPRESA C
              │            │            │
           Site A        Site B        Site C
              │            │            │
           Agenda        Agenda        Agenda
           Clientes      Clientes      Clientes
           Serviços      Serviços      Serviços
```

Um único frontend Next.js serve dois contextos:

1. **Plataforma** (`/app/*`): painéis autenticados — Master, do tenant (dashboard, agenda, CRUDs).
2. **Site público do tenant** (`/[tenant]/*`): landing e fluxo de agendamento, sem login.

O site público vive em `/{slug}` (ex.: `/barbearia/agendar`).

Equivalente de `tenant.minhaplataforma.com`: o `src/middleware.ts` reescreve
`slug.minhaplataforma.com` para `/{slug}` quando `NEXT_PUBLIC_PLATFORM_DOMAIN`
está configurado e há DNS wildcard. Sem wildcard (preview/local), use o caminho
`/{slug}` diretamente.

## Decisões arquiteturais

- **Multi-tenancy por subcoleção**: cada tenant é um documento `tenants/{tenantId}` e seus
  dados vivem em subcoleções (`services`, `appointments`, etc.). Isso simplifica as regras de
  segurança (escopo por tenant) e facilita índices compostos e cotas.
- **Regras de negócio isoladas**: as validações (geração de horários, double booking) ficam
  em módulos puros (`lib/availability`) e na camada de repositório, não dentro dos componentes.
- **Abstrações de providers**: todas as integrações externas passam por interfaces
  (`AuthProvider`, `PaymentProvider`, `EmailProvider`, `WhatsAppProvider`, `StorageProvider`,
  `NotificationProvider`), permitindo trocar o provedor sem reescrever o sistema.
- **Segurança em camadas**: RBAC no frontend (UX), no backend (API routes, Admin SDK) e nas
  regras do Firestore (autoridade final para acesso aos dados).
- **Economia de leituras**: uso de queries específicas, paginação e `onSnapshot` apenas onde
  há valor realtime (ex.: tenant ativo no painel).

## Fluxos principais

### Autenticação
```
Usuário → Login/Cadastro → Firebase Auth → usuário autenticado
                                        → perfil em /users/{uid}
```

### Criação de empresa (tenant)
```
Usuário → Onboarding → cria tenant (TENANT_OWNER)
        → writeBatch: tenants/{id} + tenant_users/{uid_id} + users/{uid}.activeTenantId
```

### Agendamento (site público)
```
Cliente → escolhe serviço → profissional → data
       → motor de disponibilidade gera slots livres
       → cliente informa dados
       → transação Firestore valida conflito (double booking)
       → cria appointment + upsert customer
```

### Regras de acesso
```
request.auth.uid → tenant_users (membership) → role → permissão
```

## Fluxo de CI/CD
```
Git push → GitHub Actions (lint → typecheck → test → build) → deploy Vercel/Firebase
```
