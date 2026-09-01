# Firebase — Configuração

Este projeto usa o **plano Spark (free tier oficial)** do Firebase. Nada de planos pagos
para colocar o MVP no ar.

## Serviços utilizados

| Serviço | Uso |
| --- | --- |
| Firebase Authentication | Cadastro/login e-mail/senha (Google opcional) |
| Cloud Firestore | Banco de dados principal (multi-tenant) |
| Cloud Storage | Logos, fotos de serviços/profissionais |
| Hosting | Opcional — deploy estático (ver DEPLOYMENT.md) |
| Cloud Functions | Reservado para lógica server-only quando o free tier permitir |

## Passo a passo

1. Acesse [console.firebase.google.com](https://console.firebase.google.com) e crie um projeto
   (o plano Spark não exige cartão).
2. **Authentication** → Sign-in method → habilite **E-mail/Senha**. (Google é opcional.)
3. **Firestore Database** → Criar banco no modo **produção** e defina o local.
4. **Storage** → Inicie o bucket (regiões padrão são gratuitas).
5. **Configurações do projeto → Seus apps → Web**: registre o app e copie o objeto `firebaseConfig`.
6. Preencha `.env.local` (veja `ENVIRONMENT.md`).
7. Publique as regras e os índices (ver seção **Deploy das rules** abaixo).

## Deploy das rules

O arquivo `firebase.json` aponta para `firestore.rules`, `firestore.indexes.json` e `storage.rules`.

Instale a CLI se ainda não tiver (`npx firebase-tools` já basta) e autentique:

```bash
npx firebase login
npx firebase use --add
```

Publique Firestore rules, índices e Storage rules:

```bash
npx firebase deploy --only firestore:rules,firestore:indexes,storage
```

Ou separadamente:

```bash
npx firebase deploy --only firestore:rules
npx firebase deploy --only firestore:indexes
npx firebase deploy --only storage
```

Com o emulador (testes de isolamento multi-tenant):

```bash
npx firebase emulators:start --only auth,firestore,storage
```

## Regras e índices

- `firestore.rules` — isolamento multi-tenant (ver SECURITY.md).
- `firestore.indexes.json` — índices compostos usados pelo app.
- `storage.rules` — upload de logo, banner, imagem de serviço e foto de profissional restrito ao tenant do usuário autenticado. Leitura pública apenas nesses caminhos (site da empresa). Qualquer outro path é negado.

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
