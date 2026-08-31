# Testes

Framework: **Vitest** + Testing Library.

```bash
npm test           # executa uma vez
npm run test:watch # modo watch
```

## Cobertura atual

- **Motor de disponibilidade** (`src/lib/availability/engine.ts`): geração de slots,
  expediente, intervalos, folgas, férias, bloqueios, feriados, conflitos com agendamentos.
- **RBAC** (`src/lib/rbac/roles.ts`): hierarquia de papéis e permissões.

## Estratégia

### Testes unitários
Funções puras (engine de disponibilidade, RBAC, formatação) são as de maior prioridade.

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
Verificar em: Firestore Rules, API, URLs, parâmetros, IDs, sessões e permissões.

### E2E (Fase 3)
Cadastro → empresa → serviço → profissional → horário → site → cliente →
agendamento → pagamento → notificação → atendimento → avaliação.

## Rodando com o emulador (Firestore)

1. `npx firebase init emulators`
2. `npx firebase emulators:start`
3. Configure `NEXT_PUBLIC_FIREBASE_*` apontando para `localhost:8080` e o
   Firestore em modo emulador (`firebase emulators:exec "npm test"`).
