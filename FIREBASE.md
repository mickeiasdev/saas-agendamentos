# Firebase — Configuração

Este projeto usa o **plano Spark (free tier oficial)** do Firebase. Nada de planos pagos
para colocar o MVP no ar.

Projeto ativo: **experimento-saas-agendamento** (`experimento-saas-agendamento.firebaseapp.com`).
A config web pública está em `src/lib/firebase/config.ts` (fallback) e em `.env.local`.
O Admin SDK lê `firebase-adminsdk.json` na raiz.
O primeiro usuário (ou o e-mail em `PLATFORM_OWNER_EMAIL`) vira `PLATFORM_OWNER` via `/api/app/bootstrap`.

## Serviços utilizados

| Serviço | Uso |
| --- | --- |
| Firebase Authentication | Cadastro/login e-mail/senha (Google opcional) |
| Cloud Firestore | Banco de dados principal (multi-tenant) |
| (não usado) Cloud Storage | — | Fotos usam Firestore (data URL comprimido) para evitar o plano pago |
| Hosting | Opcional — deploy estático (ver DEPLOYMENT.md) |
| Cloud Functions | Reservado para lógica server-only quando o free tier permitir |

## Passo a passo

1. Acesse [console.firebase.google.com](https://console.firebase.google.com) e crie um projeto
   (o plano Spark não exige cartão).
2. **Authentication** → Sign-in method → habilite **E-mail/Senha**. (Google é opcional.)
3. **Firestore Database** → Criar banco no modo **produção** e defina o local.
4. **Não ative Cloud Storage** neste MVP. Logos, banners e fotos são comprimidos no browser e gravados no Firestore (data URL). O documento do Firestore tem limite de 1 MiB — as imagens ficam bem abaixo disso.
5. **Configurações do projeto → Seus apps → Web**: registre o app e copie o objeto `firebaseConfig`.
6. Preencha `.env.local` (veja `ENVIRONMENT.md`) se quiser sobrescrever o fallback.
   O JSON do Admin SDK fica em `firebase-adminsdk.json` na raiz.
   Se o Admin SDK retornar `invalid_grant` / JWT inválido, gere uma **nova chave** em
   Console → Configurações do projeto → Contas de serviço → Gerar nova chave privada.
7. Publique as regras e os índices do Firestore (ver seção **Deploy das rules** abaixo).

## Deploy das rules

O arquivo `firebase.json` aponta para `firestore.rules`, `firestore.indexes.json` e `storage.rules`.

Instale a CLI se ainda não tiver (`npx firebase-tools` já basta) e autentique:

```bash
npx firebase login
npx firebase use --add
```

Publique Firestore rules e índices:

```bash
npx firebase deploy --only firestore:rules,firestore:indexes
```

Ou separadamente:

```bash
npx firebase deploy --only firestore:rules
npx firebase deploy --only firestore:indexes
```

Com o emulador (testes de isolamento multi-tenant):

```bash
npx firebase emulators:start --only auth,firestore
```

## Regras e índices

- `firestore.rules` — isolamento multi-tenant (ver SECURITY.md).
- `firestore.indexes.json` — índices compostos usados pelo app.
- `storage.rules` — mantido apenas como referência futura. O MVP **não usa** Cloud Storage.

## Economia de leituras/escritas

O free tier do Firestore possui limites (ver FREE_TIER.md). Estratégias aplicadas:

- Queries específicas por tenant, com filtros e paginação (`startAfter` + `limit`).
- `onSnapshot` apenas no tenant ativo do painel; telas de CRUD usam leituras pontuais.
- Horários disponíveis são **derivados** (expediente − agendamentos), sem documentos de slot.
- Evitar carregar coleções inteiras (ex.: clientes são paginados).

## Migração futura

A camada de dados está isolada em `src/lib/repository/*` e as integrações em
`src/lib/providers/*` (interfaces). Isso permite migrar o backend para outra
infraestrutura (PostgreSQL, Supabase, etc.) sem reescrever a aplicação.
