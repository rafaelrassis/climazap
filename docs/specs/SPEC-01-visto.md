# SPEC 01: "visto" (cliente abriu o link) e cobrança por contexto

Leia `CLAUDE.md` antes. Regras do projeto valem (mobile-first 360–420px, Server Actions com Zod, dinheiro em centavos, commits curtos na `main`, nunca commitar `.env`).

## Objetivo

Registrar quando o cliente abre o link público pela primeira vez e usar isso na tela e na mensagem de cobrança.

## Passo 1: banco

- `Quote.viewedAt DateTime?`.
- Gerar a migration com `npx prisma migrate dev --name quote_viewed_at` num banco de teste (nunca `migrate reset`, nunca produção). Não escrever SQL à mão.
- Zerar `viewedAt` onde o orçamento volta para `DRAFT` (editar enviado). Achar com `grep -n 'status: "DRAFT"' src/actions/quotes.ts`. Duplicar/contraproposta criam linha nova, já nasce `null`.

## Passo 2: Server Action pública

`markQuoteViewed(publicId: string): Promise<ActionResult>` em `src/actions/quotes.ts`:
- Mesmo padrão de `approveQuoteByPublicId`: rate limit `public:<ip>`, regex do `publicId`.
- `updateMany({ where: { publicId, status: "SENT", viewedAt: null }, data: { viewedAt: new Date() } })`. Atômico, só a 1ª abertura conta.
- Não marcar se houver sessão e `session.user.id` for o dono do orçamento (técnico testando o próprio link). A sessão é opcional aqui; a action continua pública.
- Se `count > 0`: `revalidatePath("/inicio")`, `"/orcamentos"`, `/orcamentos/<id>` (buscar o id). **Não** revalidar `/o/...`.
- Sem notificação push (ruído).

## Passo 3: página pública

Componente cliente `src/components/quotes/view-beacon.tsx` (retorna `null`) chamado em `src/app/o/[publicId]/page.tsx`: no `useEffect`, só quando `document.visibilityState === "visible"`, chama `markQuoteViewed(publicId)` uma vez. A página tem `revalidate = 300` (cache), então o registro **não** pode ficar no render do servidor. Prévias e robôs do WhatsApp não executam JS, por isso não contam.

## Passo 4: telas do técnico

- `/orcamentos/[id]`: "Visto em DD/MM HH:mm" (fuso America/Sao_Paulo) ou "Ainda não visto" quando `SENT`.
- `/orcamentos` e card de `/inicio` ("Sem resposta ou vencendo"): selo curto em `SENT`: "visto" ou "não abriu o link". Sem aumentar a altura do card em 360px.
- Helper puro em `src/lib/followup.ts`: `viewedLabel(viewedAt, status)`.

## Passo 5: mensagem de cobrança

`followUpMessage` recebe `viewedAt`. Precedência: urgência (vence em até 24h) > modelo próprio do técnico (`nudgeTemplate`) > variante por visto, usada só quando `nudgeTemplate` é nulo:
- não visto: `NOT_VIEWED_NUDGE_TEMPLATE` = "Oi, {cliente}! Mandei o orçamento #{numero} por aqui. Conseguiu abrir o link?\n{link}"
- visto: o `DEFAULT_NUDGE_TEMPLATE` atual.
Atualizar todos os chamadores (`/inicio`, `/orcamentos`, resumo semanal em `src/lib/reminders.ts`) e o `select` das queries com `viewedAt`. Em Ajustes, acrescentar uma linha de ajuda: "Sem modelo próprio, usamos uma mensagem diferente para quem ainda não abriu o link."

## Passo 6: testes

- Integração (`tests/integration/`): marca só `SENT`; só a 1ª vez (data não muda); não marca `DRAFT`/`APPROVED`; `publicId` inválido falha; dono logado não marca; editar enviado zera.
- Unitário: `viewedLabel`, precedência dos três templates (urgência vence modelo próprio, modelo próprio vence variante).
- E2E `tests/e2e/visto.spec.ts` (Pixel 5): contexto anônimo abre `/o/<publicId>` → técnico vê "Visto em" no detalhe e o selo em `/orcamentos`; outro orçamento nunca aberto mostra "não abriu o link" e o Cobrar usa a variante.
- Os testes existentes de `cobranca.spec.ts` não podem ser enfraquecidos; se algum assert de texto quebrar por causa da variante, ajustar o dado de teste (marcar `viewedAt`), não o assert.

## Critérios de aceite

- [ ] `lint`, `tsc`, `npm test`, `npm run build`, `npm run test:e2e` verdes.
- [ ] Migration gerada pelo Prisma, sem drift.
- [ ] `/o/...` continua com cache (`revalidate = 300`).
- [ ] `CLAUDE.md` atualizado (seções Cobrança e Estado atual).

## Não fazer

- Nada de push/e-mail de "visto". Nada de contador de aberturas, só a primeira. Não mudar versões fixadas de `next-auth`, `prisma`, `@prisma/client`.

## Relatório final (curto)

Falhas e correções, resultado de cada comando, pendências.
