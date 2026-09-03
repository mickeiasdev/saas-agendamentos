# Variáveis de ambiente

Todas as variáveis usadas pelo projeto estão documentadas em `.env.example`.
Nunca commite `.env.local` (está no `.gitignore`).

| Variável | Obrigatória | Exposição | Descrição |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Sim (para rodar o app) | Pública (browser) | API key do projeto Firebase |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Sim | Pública | `projeto.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Sim | Pública | ID do projeto |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Não | Pública | Não usado. Fotos são data URL no Firestore. |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Sim para APIs públicas (opção arquivo) | Server-only | Caminho para `firebase-adminsdk.json` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Sim | Pública | Sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Sim | Pública | App ID |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Sim para APIs públicas (opção A) | Server-only | JSON da service account (Admin SDK) |
| `FIREBASE_PROJECT_ID` | Sim para APIs públicas (opção B) | Server-only | Project ID da service account |
| `FIREBASE_CLIENT_EMAIL` | Sim para APIs públicas (opção B) | Server-only | E-mail da service account |
| `FIREBASE_PRIVATE_KEY` | Sim para APIs públicas (opção B) | Server-only | Chave privada (mantenha `\n` escapados) |
| `NEXT_PUBLIC_PLATFORM_DOMAIN` | Não | Pública | Domínio base dos sites públicos (default `minhaplataforma.com`) |
| `PLATFORM_OWNER_EMAIL` | Não | Server-only | E-mail promovido a PLATFORM_OWNER no bootstrap. Se vazio, o primeiro usuário vira dono. |

O Admin SDK aceita **opção arquivo** (`firebase-adminsdk.json` / `FIREBASE_SERVICE_ACCOUNT_PATH`),
**opção JSON** (`FIREBASE_SERVICE_ACCOUNT_JSON`) **ou** campos separados
(`FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`).
Sem uma delas, as rotas `/api/public/*` retornam erro 503 — nunca dados fake.

## Segurança

- `NEXT_PUBLIC_*` é visível ao browser por definição — nunca coloque segredos nela.
- A API key do Firebase **não é um segredo**: a segurança real está nas
  **Firebase Security Rules** (ver SECURITY.md).
- Variáveis server-only (`FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_PRIVATE_KEY`,
  `FIREBASE_CLIENT_EMAIL`) nunca devem ser prefixadas com `NEXT_PUBLIC_`.

## Em produção

Defina as variáveis no painel da Vercel (Settings → Environment Variables) ou no
Firebase Hosting, conforme DEPLOYMENT.md.
