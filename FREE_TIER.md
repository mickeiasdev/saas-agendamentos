# Free Tier — Serviços, limites e economia

Documento especial exigido pelo projeto: mapeia todos os serviços gratuitos usados,
seus limites relevantes e as estratégias de economia de custo.

## Firebase (Spark — free tier oficial)

| Serviço | Limite free tier | Uso no MVP | Observações |
| --- | --- | --- | --- |
| Cloud Firestore | 50k leituras/dia, 20k escritas/dia, 20k exclusões/dia, 1 GiB armazenamento | Banco principal | Limite mais crítico |
| Authentication | 50k usuários MAU | Login/cadastro e-mail/senha | Google opcional |
| Cloud Storage | 5 GiB, 1 GB/dia download | Logos e fotos | |
| Hosting | 10 GB de transferência/mês | Deploy estático | |
| Cloud Functions | 2M invocações/mês (plano Spark) | Lógica server-only | Usar com moderação |

**Não exige cartão de crédito** no plano Spark.

## APIs externas

| API/Serviço | Finalidade | Free tier | Limite | Necessita cartão? |
| --- | --- | --- | --- | --- |
| Firebase (conjunto) | Auth, banco, storage | Spark | Acima | Não |
| Vercel | Hosting Next.js | Hobby | 100 GB bandwidth/mês | Não (opcional) |
| E-mail (futuro) | Notificações | A definir (ex.: provedores com free tier) | A definir | A definir |
| Pagamento (futuro) | Pagamentos | Nenhum gateway com free tier adequado confirmado | — | Provavelmente |
| WhatsApp (futuro) | Notificações | Cloud API paga por conversa | — | Provavelmente |
| Google Calendar (futuro) | Integração | Gratuito via OAuth | Quotas padrão | Não |

## Regras aplicadas

1. **Nada pago obrigatório** para colocar o MVP no ar.
2. **Trial não conta como free tier** (ex.: "14 dias grátis" não é aceito).
3. **Cartão**: priorizar serviços que não exijam cartão para começar.
4. Se o serviço exigir pagamento → **criar arquitetura + provider desativado** + documentar,
   e **nunca simular** que está funcionando.

## Estratégias de economia do Firestore

- Paginação em todas as listas grandes (`startAfter` + `limit`).
- Queries específicas + índices; sem varrer coleções.
- `onSnapshot` somente no tenant ativo (realtime onde importa).
- Slots de horário derivados (sem documentos extras).
- Leituras/escritas mínimas por ação do usuário.

## Estimativa de consumo (MVP)

Com poucas empresas e tráfego baixo, o uso diário fica muito abaixo dos limites do
Spark. O painel Master orienta o acompanhamento pelo console do Firebase
(Usage & Billing), sem inventar números.

## Limitações documentadas (backup avançado, monitoramento)

- Backup automatizado avançado exige serviços pagos → documentado; usar exportação
  manual (`gcloud firestore export`) no free tier.
- Monitoramento de erros: ferramentas gratuitas (ex.: error monitor no plano free);
  ampliar conforme crescer.
