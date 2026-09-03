# Testes

Framework: **Vitest** + Testing Library + **Playwright** (E2E).

```bash
npm test           # executa uma vez
npm run test:watch # modo watch
npm run test:e2e   # Playwright (cadastro, empresa, CRUDs, agenda, Google)
```

## Cobertura atual

- **Motor de disponibilidade** (`src/lib/availability/engine.ts`, `src/lib/booking/timezone.ts`):
  expediente, intervalos, folgas, férias, bloqueios, feriados.
- **Agendamento** (`src/lib/booking/server.ts`, `src/lib/repository/overlap.ts`):
  double booking, overlap na transação, cancelamento, remarcação.
- **RBAC e isolamento** (`src/lib/rbac/*`, `src/lib/firestore.rules.test.ts`, `src/lib/firestore.rules.emulator.test.ts`):
  Tenant A tenta acessar Tenant B → NEGADO (texto das rules + emulador Firestore).
- **Site público** (`src/lib/branding/theme.ts`, `src/lib/tenant/slug.ts`):
  tema light/dark e equivalente de `tenant.minhaplataforma.com`.
- **Cancel sem Admin SDK** (`src/lib/server/firebaseAdmin.test.ts`):
  API responde 503 `ok:false` em vez de lançar.

## Estratégia

### Testes unitários
Funções puras (engine de disponibilidade, RBAC, overlap, tema, slug) são as de maior prioridade.
A suíte `src/lib/phase1.test.ts` cobre o aceite da Fase 1:
cadastro/login/senha, empresa, serviço, categoria, profissional, horário, cliente (busca), agendamento, cancelamento e remarcação.

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
Verificar em: Firestore Rules no emulador (`src/lib/firestore.rules.emulator.test.ts`),
API pública (`src/lib/booking/server.test.ts`), membership (`src/lib/rbac/membership.test.ts`).

### E2E (Fase 1)
Playwright cobre o aceite da Fase 1 contra o Firebase real (`.env.local`):

```bash
npx playwright install --with-deps chromium
npm run test:e2e
```

- `e2e/phase1.spec.ts`: cadastro → empresa → categoria → profissional → serviço → cliente → disponibilidade → agenda → login → site público.
- `e2e/google-login.spec.ts`: botão Google no login/cadastro e início do fluxo OAuth.

O clique real no Google abre o popup da Google. Sem uma conta de teste OAuth no CI, o teste aceita popup, redirect ou mensagem de provedor não habilitado / domínio não autorizado.

### E2E (Fase 3)
Cadastro → empresa → serviço → profissional → horário → site → cliente →
agendamento → pagamento → notificação → atendimento → avaliação.

## Rodando com o emulador (Firestore)

```bash
# Rules reais: Tenant A não lê Tenant B, slug único, convite não nasce no cliente
npm run test:rules
```

Requer Java (JRE) e o emulador Firestore. Sem o emulador, `npm test` segue
passando (a suíte do emulador é ignorada automaticamente).
