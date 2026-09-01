# Segurança

## Isolamento multi-tenant (Firestore Rules)

As regras em `firestore.rules` são a **autoridade final** de acesso aos dados.
Um usuário autenticado só consegue ler/escrever dados de tenants onde ele é
membro ativo (`tenant_users/{uid_tenantId}`).

- Membros ativos leem/gerenciam as subcoleções do seu tenant.
- O dono do tenant (TENANT_OWNER) tem privilégios administrativos.
- Nenhum usuário de Tenant A consegue ler documentos de Tenant B.
- O site público **não** lê o Firestore no cliente: consome a API
  `/api/public/site/[slug]` (Admin SDK) com projeção sanitizada.

## RBAC

Papéis verificados em três camadas:

| Papel | Frontend (UX) | Firestore Rules | Backend (API) |
| --- | --- | --- | --- |
| PLATFORM_OWNER | Menus filtrados | Acesso global | Sim |
| PLATFORM_ADMIN | Menus filtrados | Acesso global | Sim |
| TENANT_OWNER | Tudo do tenant | CRUD total do tenant | Sim |
| TENANT_ADMIN | Gestão | CRUD do tenant | Sim |
| MANAGER | Operação | CRUD operacional | Sim |
| PROFESSIONAL | Agenda/Clientes | Leitura + agenda | Sim |
| CUSTOMER | Site público | Apenas self-service | Sim |

A checagem no código fica em `src/lib/rbac/roles.ts` (`can(role, permission)`).

## Boas práticas aplicadas

- **Nunca confiar apenas no frontend**: toda validação crítica (double booking,
  disponibilidade) roda no Firestore/backend.
- **Credenciais fora do repositório**: apenas `.env.local` (gitignorado) e `.env.example`.
- **Prevenção de double booking**: transação Firestore que lê conflitos antes de gravar.
- **Validação e sanitização**: em todo formulário e nas API routes.
- **Não simular integrações**: providers não configurados ficam desativados e são
  explicitamente reportados ao usuário.

## Roadmap de segurança (Fase 3)

- [ ] Firebase App Check (proteção de endpoints)
- [ ] Rate limiting em API routes e API pública
- [ ] Headers de segurança (CSP, HSTS, etc.) e cookies seguros
- [ ] 2FA
- [ ] Auditoria completa de ações administrativas e impersonation com registro
- [ ] Monitoramento de erros e disponibilidade

## LGPD

Preparar (Fase 3): política e termos, consentimento, exportação de dados,
exclusão/anonimização e política de retenção. A base já armazena apenas os dados
mínimos necessários por cliente.
