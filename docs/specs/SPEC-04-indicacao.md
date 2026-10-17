# SPEC 04: indicação entre técnicos (só rastreio)

Pré-requisitos: SPEC-02 concluída. Leia `CLAUDE.md`.

## Objetivo

Cada técnico tem um link de convite; quem se cadastra por ele fica ligado a quem indicou. Sem recompensa (não há cobrança ainda): o objetivo é medir se o boca a boca funciona.

## Passo 1: banco

- `User.referralCode String? @unique` (6 caracteres de `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, sem caracteres ambíguos), `User.referredById String?` com relação `referredBy`/`referrals` (`onDelete: SetNull`), índice em `referredById`.
- Migration pelo Prisma (`npx prisma migrate dev --name referral`, banco de teste). O código é gerado sob demanda (1º acesso a Ajustes), sem backfill.

## Passo 2: Server Actions

- `ensureReferralCode()` em `src/actions/settings.ts`: `requireUserId`, devolve o código existente ou cria com retry em colisão (`P2002`, até 5 tentativas).
- `registerAction` (`src/actions/auth.ts`) aceita `ref` opcional: validar com Zod (`^[A-Z2-9]{6}$` após `toUpperCase()`), buscar o dono; código inexistente é **ignorado** em silêncio (não bloqueia o cadastro, não revela se o código existe). Gravar `referredById`.
- `src/lib/referral.ts`: `generateReferralCode()` puro e testável.

## Passo 3: telas

- `/cadastro?ref=CODE`: guardar `ref` em campo oculto do formulário (a página lê `searchParams`, assíncrono: `await`).
- Ajustes: card "Indique um colega" com o link `${NEXT_PUBLIC_APP_URL}/cadastro?ref=CODE`, botão copiar (`copy-button.tsx` já existe) e botão WhatsApp (`buildWhatsAppUrl` sem telefone? usar `https://wa.me/?text=...`). Mensagem fixa e curta. Contador "N colegas criaram conta". Sem nomes nem e-mails de indicados.
- 360px sem rolagem horizontal, botões ≥ 44px.

## Passo 4: LGPD e métricas

- `/api/meus-dados` (exportar): incluir `referralCode` e a contagem de indicados.
- `deleteAccount`: nada a mudar (`SetNull`); confirmar com teste.
- `src/lib/metrics.ts` (SPEC-02): `referrals(users)` → indicados por técnico (só contagens) e % dos indicados que ativaram (≥1 orçamento enviado em 7 dias). Incluir no `npm run metricas`.

## Passo 5: testes

- Unitário: `generateReferralCode` (alfabeto, tamanho), `referrals`.
- Integração: `ensureReferralCode` idempotente; cadastro com `ref` válido grava `referredById`; `ref` inválido/inexistente cadastra normalmente sem vínculo; excluir quem indicou não apaga o indicado.
- E2E `tests/e2e/indicacao.spec.ts`: técnico A copia o link em Ajustes; contexto novo abre o link, cadastra B; A vê "1 colega criou conta".

## Critérios de aceite

- [ ] `lint`, `tsc`, `npm test`, `npm run build`, `npm run test:e2e` verdes; sem drift.
- [ ] Página de privacidade cita o vínculo de indicação (1 frase); `CLAUDE.md` atualizado.

## Não fazer

- Sem recompensa, crédito ou cupom. Sem exibir dados pessoais do indicado. Sem rastreio por cookie de terceiros.

## Relatório final (curto)

Resultado dos comandos e pendências.
