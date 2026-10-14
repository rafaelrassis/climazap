---
description: Roda os testes E2E do Playwright (celular) e explica as falhas
---
1. Garanta o Postgres de teste no ar (`pg_isready`; senão `pg_ctlcluster 16 main start`) e que não há `next-server` antigo ocupando a porta 3200 (`ps aux | grep next-server`; encerre só esse PID, nunca use `pkill -f` com texto que apareça no próprio comando).
2. `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npx playwright test $ARGUMENTS` (o Playwright faz o build e sobe o servidor sozinho, em ~40 s).
3. Para cada falha, leia `test-results/*/error-context.md` e a saída `[WebServer]` antes de concluir. Separe: bug do app, bug do teste (seletor ambíguo, e-mail com maiúscula, rate limit do mesmo IP) ou ambiente.
4. Rate limits entram nos testes: cadastro (15/h por IP), login (8 por IP+e-mail em 15 min). Os helpers de `tests/e2e/helpers.ts` já variam o IP com `x-forwarded-for`.
