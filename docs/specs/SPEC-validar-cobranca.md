# SPEC: validar e fechar o ciclo de cobrança

Para o Claude Code executar no repo `climazap` (FechouClima). Leia `CLAUDE.md` antes. Regras do projeto valem: mobile-first 360–420px, Server Actions com Zod + `requireUserId()` + filtro por dono, dinheiro em centavos, commits curtos (Conventional Commits) direto na `main`, nunca commitar `.env`.

## Contexto

Foram entregues, sem nunca terem rodado contra banco real (o ambiente anterior não conseguia gerar o Prisma client):

| Commit | O quê |
|---|---|
| `e97bb59`, `1332550` | Aviso "vence em até 24h" e botão Cobrar no `/inicio` e em `/orcamentos` |
| `d281e6a`, `869b29c`, `19daa4a` | `Quote.lastNudgeAt`, `markQuoteNudged`, `snoozeQuoteFollowUp` (bloqueia quem vence em até 24h) |
| `7d510b1` | `src/lib/followup-queries.ts` (filtros compartilhados painel/e-mail) |
| `f785c9f`, `d4b2f0d` | Funil de cobrança no painel e no resumo semanal |
| `dbd524b` | Tabela `QuoteNudge` (NUDGE/SNOOZE); funil passou a vir dela |
| `9b55710` | `User.nudgeTemplate` editável em Ajustes + mensagem de urgência |
| `f1b17d5` | Cron diário `/api/cron/expirar`, `src/lib/cron-auth.ts` |

Migrations novas, escritas à mão (SQL validado só num Postgres descartável):
`20261016204500_quote_last_nudge`, `20261016210000_quote_nudge`, `20261016211000_nudge_template`.

Arquivos principais: `src/actions/quotes.ts`, `src/actions/settings.ts`, `src/lib/followup.ts`, `src/lib/followup-queries.ts`, `src/lib/followup-context.ts`, `src/lib/nudge-funnel.ts`, `src/lib/reminders.ts`, `src/lib/quote-expiry.ts`, `src/app/(app)/inicio/page.tsx`, `src/app/(app)/orcamentos/page.tsx`, `src/components/quotes/{nudge-button,snooze-button}.tsx`, `src/components/settings/nudge-template-form.tsx`, `tests/unit/followup.test.ts`, `tests/integration/nudge.test.ts`, `tests/integration/cron.test.ts`.

## Objetivo

Provar que tudo acima funciona de verdade (tipos, banco, testes, tela), corrigir o que falhar e entregar um teste E2E do fluxo Cobrar/Adiar. Não adicionar funcionalidades novas.

## Passo 1: verificação (obrigatório, nesta ordem)

1. `npm ci`, depois `npx prisma generate` (precisa de rede para o engine do Prisma).
2. Confirmar que o schema e as migrations batem: `/migrar` (ou `npx prisma migrate dev --name check_drift` num banco **de teste**). Se o Prisma gerar uma migration adicional, o SQL escrito à mão divergiu do `schema.prisma`: corrija a migration existente (ou o schema), nunca deixe drift. Nunca rodar `migrate reset` nem apontar para banco de produção.
3. `npm run lint && npx tsc --noEmit`. Esperado: zero erros. Pontos de atenção: import `Prisma.QuoteWhereInput` em `followup-queries.ts`; callbacks `$transaction` em `markQuoteNudged` e `snoozeQuoteFollowUp`.
4. `npm test` (banco `climazap_test`, o nome precisa conter `test`). Esperado: tudo verde, incluindo `nudge.test.ts` e o bloco de `/api/cron/expirar` em `cron.test.ts`.
5. `npm run build`.

Para cada falha: ache a causa raiz, corrija no código ou no teste (conforme qual está errado, justificando no commit) e rode de novo. Não desligar teste, não afrouxar assert para passar.

Pontos onde o código foi escrito sem poder rodar e que merecem atenção:
- Teste do funil: um orçamento cobrado 2x conta 1; adiar não conta; cobrança de 40 dias fica fora; aprovado antes da cobrança não conta.
- Teste do painel (`followUpWhere`): janela de 24h para orçamentos que vencem em breve vs. 48h para os parados, e `validUntil` nulo ainda aparece em `staleWhere`.
- Resumo semanal: a linha do funil só aparece quando houve cobrança; quem não tem nada a cobrar não recebe e-mail.

## Passo 2: teste E2E (Playwright, Pixel 5)

Crie `tests/e2e/cobranca.spec.ts` seguindo o padrão e os helpers de `tests/e2e/` (leia `helpers.ts` e um spec existente antes). Cenário, em viewport de celular:

1. Técnico logado com 2 orçamentos `SENT`: A enviado há 3 dias com validade de 5 dias; B com `validUntil` em 12h.
2. `/inicio` mostra a seção "Sem resposta ou vencendo" com A e B; B exibe "vence em até 24h" e **não** exibe "Adiar 3 dias".
3. Em A, o botão **Cobrar** tem `href` `wa.me/55…` com `text` contendo `Conseguiu ver o orçamento #N` e o link `/o/<publicId>`. Em B, o texto contém "vence em breve".
4. Clicar em Cobrar (interceptar a navegação para o WhatsApp, não abrir de fato): A some do painel após o refresh, e `QuoteNudge` tem 1 linha NUDGE.
5. Em outro orçamento C (parado, não cobrado): **Adiar 3 dias** o remove do painel, mostra toast, cria 1 linha SNOOZE e `/orcamentos` exibe "adiado até DD/MM".
6. Em `/ajustes`, salvar um modelo de cobrança com `{cliente}` e `{numero}`, e confirmar que o Cobrar seguinte usa o texto novo; "Voltar ao padrão" restaura.
7. Em 360px: sem rolagem horizontal, botões com altura de toque ≥ 44px (o projeto já tem checagem de layout em `tests/e2e/`; reutilize).

Rodar com `/e2e`. Se o E2E achar bug de UI, corrigir.

## Passo 3: ajustes de qualidade (só se o passo 1 e 2 estiverem verdes)

- **Funil no resumo semanal** (`src/lib/reminders.ts`): hoje faz uma consulta de `getNudgeFunnel` por técnico. Se for simples e coberto por teste, trocar por uma consulta agregada (`groupBy`/uma query para todos os `userId` do lote). Se complicar, deixar como está e anotar no `CLAUDE.md` como risco conhecido.
- Revisar `CLAUDE.md` (seções Cron e Cobrança) para refletir o que de fato ficou.

## Critérios de aceite

- [ ] `prisma generate`, `migrate` sem drift, `lint`, `tsc`, `npm test`, `npm run build` e o E2E novo: todos verdes.
- [ ] Nenhuma migration nova pendente fora das 3 acima (ou, se houver, só para corrigir drift).
- [ ] Nenhum teste existente desabilitado ou enfraquecido.
- [ ] Commits pequenos, um por correção/item, enviados na `main`.

## Não fazer

- Não criar funcionalidades novas além do que está nesta spec.
- Não rodar `migrate reset`/`--force-reset`, nem tocar em banco de produção.
- Não alterar `lastNudgeAt` como mecanismo de ocultação (é o que esconde da lista; `QuoteNudge` é só histórico).
- Não commitar `.env` nem segredos. Não mudar versões fixadas de `next-auth`, `prisma` e `@prisma/client`.

## Relatório final (curto)

Liste: o que falhou e como foi corrigido, resultado de cada comando do Passo 1, resultado do E2E, o que ficou pendente, e quais variáveis o deploy precisa (`CRON_SECRET` na Vercel; `npx prisma migrate deploy` aplicado antes do primeiro acesso).
