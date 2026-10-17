# SPEC 02: métricas de validação (retenção e funil)

Pré-requisito: SPEC-01 concluída (usa `viewedAt`). Leia `CLAUDE.md`.

## Objetivo

Um script de **leitura** que responde: os técnicos voltam? Sem tabela de eventos nova (tudo sai de `User`, `Quote`, `QuoteNudge`).

## Passo 1: cálculo puro e testável

`src/lib/metrics.ts` com funções puras (recebem linhas já lidas, sem Prisma):
- `weeklyCohorts(users, quotes)`: agrupa técnicos pela semana de cadastro (segunda-feira, fuso America/Sao_Paulo). Por coorte: cadastrados, % com ≥1 orçamento enviado nos 7 dias seguintes ao cadastro (ativação), % com ≥2 orçamentos enviados entre os dias 7 e 14 (retenção).
- `funnel(quotes)`: enviados → vistos → aprovados, em % e em número, por semana de envio; mediana de horas até `respondedAt`.
- `nudgeEffect(quotes, nudges)`: dos orçamentos `SENT` sem resposta há 2+ dias, % aprovado depois de cobrado vs. não cobrado (só com ≥10 por grupo; abaixo disso, imprimir "amostra pequena").
- `referrals` fica para a SPEC-04.
Testes unitários em `tests/unit/metrics.test.ts` com datas fixas, incluindo virada de semana e de fuso (domingo 23h BRT).

## Passo 2: script

`scripts/metricas.ts`, `npm run metricas` (`tsx scripts/metricas.ts`):
- Só `SELECT` via Prisma (`findMany` com `select` mínimo). Nenhuma escrita, sem `$executeRaw`.
- Exclui e-mails que casem com `METRICAS_EXCLUIR` (regex, padrão `@fechouclima\.com\.br$|^demo@`), para tirar contas de teste.
- Imprime com `console.table`, sem e-mail nem nome de técnico (só contagens); LGPD.
- Sem `DATABASE_URL` falha com mensagem clara. Aviso no topo da saída: "Rodando contra: <host do banco>".
- Documentar em `DEPLOY.md`: rodar com a URL direta do Neon, de fora da Vercel.

## Critérios de aceite

- [ ] `lint`, `tsc`, `npm test`, `npm run build` verdes; script roda contra o banco de teste semeado e imprime as 3 tabelas.
- [ ] Nenhuma escrita no banco; nenhum dado pessoal na saída.

## Não fazer

- Não criar tabela `Event`, painel web nem endpoint de métricas. Não instalar analytics de terceiros.

## Relatório final (curto)

Resultado dos comandos e um exemplo da saída com o banco de teste.
