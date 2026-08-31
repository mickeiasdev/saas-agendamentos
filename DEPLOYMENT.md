# Deployment — Deploy gratuito

## Opção 1 — Vercel (recomendado para Next.js)

1. Crie uma conta na [Vercel](https://vercel.com) (plano Hobby é gratuito para projetos pessoais).
2. Importe o repositório GitHub.
3. Preencha as variáveis de ambiente do projeto no painel da Vercel
   (todas as `NEXT_PUBLIC_FIREBASE_*` e, se usadas, as variáveis server-only).
4. Deploy automático a cada push (ver CI/CD em `.github/workflows/ci.yml`).

## Opção 2 — Firebase Hosting

```bash
npm run build
npx firebase init hosting   # escolha "out" como public dir
npx firebase deploy --only hosting
```

Se usar o Firebase Hosting com `[tenant]` como rota, configure o reescrever para
todas as rotas apontarem para o app Next.js (SSR exige `next start` via Cloud Run —
para estático puro, use `output: 'export'`).

## Site público por tenant

- **Local/preview**: `/nome-da-empresa` dentro da mesma aplicação.
- **Produção**: `empresa.minhaplataforma.com` via wildcard DNS apontando para a Vercel,
  ou `empresa.minhaplataforma.com` como subdomínio no Firebase Hosting.
- Domínios personalizados (`www.cliente.com.br`) ficam para a Fase 3 (o custo do domínio
  é responsabilidade do cliente).

## Pipeline CI/CD (GitHub Actions)

Fluxo: `git push` → `lint` → `typecheck` → `test` → `build`. Deploy automático na
Vercel/Firebase quando as credenciais forem adicionadas ao repositório (secrets).
