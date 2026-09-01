# API

## API pública (Fase 3 — implementada: 3.12 + 3.13)

A API pública expõe recursos da plataforma para integração externa, protegida por
**API keys** (criação, revogação, rotação, permissões, rate limit e logs).

| Método | Endpoint | Escopo exigido | Descrição |
| --- | --- | --- | --- |
| GET | `/api/v1/appointments` | `appointments:read` | Lista agendamentos (`limit`, `status`, `from`, `to`) |
| POST | `/api/v1/appointments` | `appointments:write` | Cria agendamento (usa o motor de booking) |
| GET | `/api/v1/customers` | `customers:read` | Lista clientes (`limit`, `cursor`, `search`) |
| POST | `/api/v1/customers` | `customers:write` | Cria cliente |
| GET | `/api/v1/services` | `services:read` | Lista serviços ativos |
| GET | `/api/v1/professionals` | `professionals:read` | Lista profissionais ativos |

Autenticação: `Authorization: Bearer <api_key>`.

A chave tem o formato `as_<base64url>`; apenas o hash SHA-256 é armazenado no
Firestore (nunca o segredo), e o segredo completo é exibido uma única vez na
criação. Rate limit padrão: 60 requisições por minuto por chave.

### Gestão de API keys (Painel Master)

Requer papel `PLATFORM_ADMIN` ou `PLATFORM_OWNER`:

| Método | Endpoint | Descrição |
| --- | --- | --- |
| GET | `/api/master/tenants/[id]/api-keys` | Lista chaves da empresa |
| POST | `/api/master/tenants/[id]/api-keys` | Cria chave (retorna `secret` uma vez) |
| POST | `/api/master/tenants/[id]/api-keys/[keyId]/revoke` | Revoga a chave |
| POST | `/api/master/tenants/[id]/api-keys/[keyId]/rotate` | Gera novo segredo |
| GET | `/api/master/tenants/[id]/api-keys/[keyId]/logs` | Logs de uso (método, path, status, IP) |

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
