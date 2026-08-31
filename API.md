# API

## API pública (Fase 3 — preparada)

A API pública expõe recursos da plataforma para integração externa, protegida por
**API keys** (criação, revogação, permissões, rate limit e logs).

| Método | Endpoint | Descrição |
| --- | --- | --- |
| GET | `/api/v1/appointments` | Lista agendamentos |
| POST | `/api/v1/appointments` | Cria agendamento |
| GET | `/api/v1/customers` | Lista clientes |
| POST | `/api/v1/customers` | Cria cliente |
| GET | `/api/v1/services` | Lista serviços |
| GET | `/api/v1/professionals` | Lista profissionais |

Autenticação: `Authorization: Bearer <api_key>`.

### Webhooks públicos (Fase 3 — preparada)

Eventos entregues por webhook:
- `appointment.created`
- `appointment.confirmed`
- `appointment.cancelled`
- `payment.approved`
- `customer.created`

Estrutura: `webhook_events` com validação de assinatura, idempotência e logs.

## Webhooks de pagamento (arquitetura)

Interface `PaymentProvider` (em `src/lib/providers/payment-provider.ts`) expõe
`handleWebhook(payload, headers)` com validação e idempotência. Nenhum gateway é
ativado no MVP até existir free tier adequado (ver FREE_TIER.md).

## Endpoints do Next.js

As rotas de API do Next.js (`src/app/api/**`) devem usar o **Firebase Admin SDK**
(server-only) para operações privilegiadas — nunca o client SDK.
