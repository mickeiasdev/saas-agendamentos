# Variáveis de ambiente

Todas as variáveis usadas pelo projeto estão documentadas em `.env.example`.
Nunca commite `.env.local` (está no `.gitignore`).

| Variável | Obrigatória | Exposição | Descrição |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Sim (para rodar o app) | Pública (browser) | API key do projeto Firebase |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Sim | Pública | `projeto.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Sim | Pública | ID do projeto |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Sim | Pública | `projeto.appspot.com` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Sim | Pública | Sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Sim | Pública | App ID |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Não (só API routes) | Server-only | JSON da service account (Admin SDK) |
| `NEXT_PUBLIC_PLATFORM_DOMAIN` | Não | Pública | Domínio base dos sites públicos (default `minhaplataforma.com`) |

## Segurança

- `NEXT_PUBLIC_*` é visível ao browser por definição — nunca coloque segredos nela.
- A API key do Firebase **não é um segredo**: a segurança real está nas
  **Firebase Security Rules** (ver SECURITY.md).
- Variáveis server-only (`FIREBASE_SERVICE_ACCOUNT_JSON`) nunca devem ser prefixadas
  com `NEXT_PUBLIC_`.

## Em produção

Defina as variáveis no painel da Vercel (Settings → Environment Variables) ou no
Firebase Hosting, conforme DEPLOYMENT.md.
