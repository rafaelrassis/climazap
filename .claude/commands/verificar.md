---
description: Roda toda a verificação do projeto (lint, tipos, Prisma, testes, build) e resume o resultado
---
Rode, nesta ordem, parando para corrigir se algo falhar:

1. `npm run lint`
2. `npx tsc --noEmit`
3. `npx prisma validate`
4. `npm test` (precisa do Postgres de teste; em sessão nova o hook `.claude/hooks/session-start.sh` já sobe)
5. `npx next build`

Se o argumento `$ARGUMENTS` contiver `e2e`, rode também `npm run test:e2e` (local: `PW_CHROMIUM_PATH=<chromium>`).

No fim, responda em português, bem curto: o que passou, o que falhou (com a mensagem) e o que você corrigiu. Se algum teste falhar, investigue a causa antes de mexer no teste: nesta base, falhas de teste já revelaram bugs reais do app.
