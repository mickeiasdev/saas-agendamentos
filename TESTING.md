# Testes

Framework: **Vitest** + Testing Library.

```bash
npm test           # executa uma vez
npm run test:watch # modo watch
```

## Cobertura atual

- **Motor de disponibilidade** (`src/lib/availability/engine.ts`, `src/lib/booking/timezone.ts`):
  expediente, intervalos, folgas, férias, bloqueios, feriados.
- **Agendamento** (`src/lib/booking/server.ts`, `src/lib/repository/overlap.ts`):
  double booking, overlap na transação, cancelamento, remarcação.
- **RBAC e isolamento** (`src/lib/rbac/*`, `src/lib/firestore.rules.test.ts`):
  Tenant A tenta acessar Tenant B → NEGADO.
- **Site público** (`src/lib/branding/theme.ts`, `src/lib/tenant/slug.ts`):
  tema light/dark e equivalente de `tenant.minhaplataforma.com`.
- **Cancel sem Admin SDK** (`src/lib/server/firebaseAdmin.test.ts`):
  API responde 503 `ok:false` em vez de lançar.

## Estratégia

### Testes unitários
Funções puras (engine de disponibilidade, RBAC, overlap, tema, slug) são as de maior prioridade.
A suíte `src/lib/phase1.test.ts` cobre o aceite da Fase 1:
cadastro/empresa/serviço/categoria/profissional/horário/cliente/agendamento/cancelamento/remarcação.

### Testes de integração (Fase 1)
Fluxo cadastro → login → empresa → serviço → profissional → horário → cliente →
agendamento → cancelamento, usando o emulador do Firebase:

```bash
npx firebase emulators:start
```

### Teste multi-tenant obrigatório
```
Tenant A → tenta acessar dados do Tenant B → NEGADO
```
Verificar em: Firestore Rules (`src/lib/firestore.rules.test.ts`), API pública
(`src/lib/booking/server.test.ts`), membership (`src/lib/rbac/membership.test.ts`).

### E2E (Fase 3)
Cadastro → empresa → serviço → profissional → horário → site → cliente →
agendamento → pagamento → notificação → atendimento → avaliação.

## Rodando com o emulador (Firestore)

1. `npx firebase init emulators`
2. `npx firebase emulators:start`
3. Configure `NEXT_PUBLIC_FIREBASE_*` apontando para `localhost:8080` e o
   Firestore em modo emulador (`firebase emulators:exec "npm test"`).
