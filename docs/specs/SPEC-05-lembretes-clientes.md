# SPEC 05: lembretes de manutenção por serviço, automáticos e com aviso no celular

Leia `CLAUDE.md` antes. Regras do projeto valem (mobile-first 360–420px, Server Actions com Zod + `requireUserId()` + filtro por dono, snapshot, commits curtos na `main`, nunca commitar `.env`). Independente das SPEC 01–04; pode rodar antes da 03/04 (é a que mais gera receita recorrente para o técnico).

## Contexto

Hoje o lembrete é **manual e genérico**: o técnico abre um orçamento aprovado, escolhe 3/6/12 meses (`MaintenanceReminder`, `setMaintenanceReminder`, grava `Quote.reminderAt`); na data, o orçamento aparece em `/inicio` com o botão **Chamar** (WhatsApp, texto fixo) e entra no resumo semanal por e-mail. Lacunas: depende de o técnico lembrar de ativar, mesmo texto para qualquer serviço, nenhum aviso no celular no dia, e nada depois de "Feito".

O aviso é para o **técnico**, que chama o cliente. Envio automático ao cliente fica fora (ver "Não fazer").

## Objetivo

1. Ao aprovar, agendar o lembrete sozinho, com prazo e texto definidos pelo **serviço** (ex.: limpeza 6 meses, "hora de limpar seu ar").
2. Mensagem do Chamar com o serviço e o nome do técnico.
3. Push no dia em que o lembrete vence.
4. Ao dar "Feito", oferecer a próxima data.

## Passo 1: banco (migration pelo Prisma, banco de teste; nunca `migrate reset`, nunca produção)

`npx prisma migrate dev --name maintenance_reminders`:
- `Service.reminderMonths Int?` (null = sem lembrete; só 3, 6 ou 12) e `Service.reminderText String?` (modelo opcional, até 300 caracteres).
- `User.defaultReminderMonths Int? @default(6)` (null = desligado). Vale só para aprovações futuras.
- `Quote.reminderText String?` e `Quote.reminderService String?` (snapshot na aprovação: o catálogo pode mudar depois sem alterar lembretes já agendados).
- `Quote.reminderNotifiedAt DateTime?` (push já enviado para este lembrete).
- Seed (`prisma/seed.ts`): preencher `reminderMonths`/`reminderText` dos serviços padrão (limpeza 6; carga de gás 12; instalação 12; manutenção preventiva 6; demais null, ajustar por nome). O seed roda em produção (ver `DEPLOY.md`): atualizar só os campos novos dos padrões (`userId: null`), **nunca** preço nem outros campos.
- Serviços com override (`overridesId`): ao criar o override, copiar `reminderMonths`/`reminderText` do padrão (ler `src/actions/services.ts`).

## Passo 2: lógica pura (`src/lib/maintenance.ts`)

- `addMonths(date, months)`: soma meses **sem estourar** o mês (31/ago + 6 → 28/fev, não 3/mar). Substituir o `setMonth` de `setMaintenanceReminder` por ela.
- `resolveReminder(items, defaultMonths)`: `items` = `{ description, service: { reminderMonths, reminderText } | null }[]`. Regra: entre itens cujo serviço tem `reminderMonths`, vale o de **menor prazo** (texto e nome daquele item); sem nenhum, usa `defaultMonths`; `null` e sem item = sem lembrete. Retorna `{ months, text, service } | null`.
- `renderMaintenanceMessage({ cliente, tecnico, servico }, text | null)`: placeholders `{cliente}`, `{tecnico}`, `{servico}`. Padrão sem texto: "Oi, {cliente}! Aqui é {tecnico}. Já faz um tempo desde o último serviço ({servico}) no seu ar-condicionado. Que tal agendar a manutenção preventiva?".
- `reminderTextSchema` (Zod) em `src/lib/validations/service.ts`: máx. 300 e **rejeita placeholder desconhecido** (senão `{xyz}` iria literal para o cliente, igual ao aviso do `NudgeTemplateForm`).

## Passo 3: Server Actions

- `approveQuoteByPublicId` (`src/actions/quotes.ts`): depois do `updateMany` que aprova, buscar itens com `service` e `user.defaultReminderMonths`, resolver com `resolveReminder` e gravar com `updateMany({ where: { id, status: "APPROVED", reminderAt: null }, data: { reminderAt: addMonths(respondedAt, months), reminderText, reminderService } })`. Falha aqui **não** pode desfazer nem travar a aprovação (try/catch com log; aprovação é o que importa). Fazer `grep -n 'status: "APPROVED"' src` e tratar qualquer outro caminho que aprove.
- `setMaintenanceReminder`: ao definir/remover, zerar `reminderDoneAt` e `reminderNotifiedAt`; manual não grava `reminderText`/`reminderService` (usa a mensagem padrão).
- `completeMaintenanceReminder(quoteId, nextMonths?: 3 | 6 | 12 | null)`: sem `nextMonths`, comportamento atual. Com valor: `reminderAt = addMonths(now, nextMonths)`, `reminderDoneAt = null`, `reminderNotifiedAt = null` (mesmo orçamento, mesmos `reminderText`/`reminderService`). Sem histórico por enquanto.
- `saveDefaultReminder(months: 3 | 6 | 12 | null)` em `src/actions/settings.ts`.
- `createService`/`updateService`: aceitar `reminderMonths` e `reminderText` (Zod).

## Passo 4: aviso no celular

`src/lib/maintenance-notify.ts` → `notifyDueReminders(now)`:
- Orçamentos `APPROVED` com `reminderAt <= now`, `reminderDoneAt = null`, `reminderNotifiedAt = null`, agrupados por `userId`.
- 1 push por técnico (`sendPushToUser`, `src/lib/push.ts`): "N cliente(s) para chamar hoje" → `/inicio`, `tag: "lembretes"`. Só marca `reminderNotifiedAt = now` dos orçamentos daquele técnico se `sendPushToUser` retornou > 0 (sem aparelho cadastrado, tenta de novo no dia seguinte).
- Chamar de dentro de `/api/cron/expirar` (cron diário que já existe, 08:00 UTC = 5h BRT; comentar no código que a rota também dispara lembretes) e devolver `{ ok, expired, notified }`. Motivo: não criar um 3º cron (planos da Vercel limitam a quantidade; confirmar). Se a rota nova for inevitável, conferir `PUBLIC_PREFIXES` em `src/auth.config.ts` e `cronAuthorized`.
- Opinião registrada: 5h da manhã é cedo para push; se o horário incomodar, mover o cron inteiro (`vercel.json`) para ~11:00 UTC (8h BRT).

## Passo 5: telas (360–420px, alvos ≥ 44px)

- **Catálogo** (`src/components/services/service-sheet.tsx`): campo "Lembrar o cliente após" (Nunca / 3 / 6 / 12 meses) e, se escolhido, textarea "Mensagem do lembrete" com ajuda dos placeholders e prévia (padrão do `NudgeTemplateForm`). Linha do serviço mostra um selo curto ("lembra em 6 meses").
- **Ajustes**: card "Lembrete automático" com o padrão geral (Desligado / 3 / 6 / 12 meses; padrão 6), em `src/components/settings/`.
- **`/inicio`** (card de lembretes): o `href` do Chamar usa `renderMaintenanceMessage` com `q.reminderText`/`q.reminderService`; incluir os campos no `select`. Mostrar "serviço de MMM/AAAA · <serviço>" quando houver `reminderService`.
- **Feito**: `CompleteReminderButton` abre o `Drawer` (`src/components/ui/drawer.tsx`) com "Agendar a próxima manutenção?": 6 meses / 12 meses / Não agendar. Toast confirmando. O botão Chamar continua **sem** marcar como feito.
- **Detalhe do orçamento** (`MaintenanceReminder`): quando agendado, mostrar "Aviso em dd/mm/aaaa" (como hoje) e, se veio do serviço, a origem: "pela limpeza" ou "padrão do app".

## Passo 6: testes

- Unitário (`tests/unit/maintenance.test.ts`): `addMonths` (31/ago + 6, 29/fev em ano bissexto, virada de ano); `resolveReminder` (menor prazo, item sem serviço, só default, default nulo → `null`, empate); `renderMaintenanceMessage` (com e sem texto); `reminderTextSchema` (placeholder desconhecido rejeitado, 300 caracteres).
- Integração (`tests/integration/`, ler `cron.test.ts` para o padrão de mock de push/e-mail): aprovar agenda pelo serviço; cai no padrão do técnico; sem lembrete com padrão nulo e sem serviço; falha ao agendar não impede a aprovação; serviço com override herda o lembrete; `notifyDueReminders` envia 1 push por técnico com N vencidos, marca `reminderNotifiedAt` só se enviou, não repete no 2º disparo, e o "Feito" com próxima data / `setMaintenanceReminder` rearma; técnico A nunca vê nem aciona lembrete do B.
- E2E `tests/e2e/lembretes.spec.ts` (Pixel 5, também 360px): (1) cliente aprova pelo link público de um orçamento com serviço de 6 meses → técnico vê "Aviso em" no detalhe; (2) orçamento aprovado com `reminderAt` no passado e texto próprio → em `/inicio` o `href` do Chamar contém o texto renderizado com o serviço; (3) "Feito" → Drawer → "6 meses" → o card some e `reminderAt` fica ≈ hoje + 6 meses; (4) sem rolagem horizontal e botões ≥ 44px.
- Não enfraquecer testes existentes (`lifecycle`, `quote-flow`, `reminders` do resumo).

## Critérios de aceite

- [ ] `npm run lint && npx tsc --noEmit && npm test && npm run build && npm run test:e2e` verdes; migration gerada pelo Prisma, sem drift.
- [ ] Seed em produção não altera preço nem dados do técnico.
- [ ] Aprovar continua funcionando se o agendamento falhar.
- [ ] `CLAUDE.md` atualizado (Estado atual, Cron: a rota `expirar` também notifica lembretes) e `README` das specs com a linha da SPEC-05.

## Não fazer

- **Envio automático ao cliente.** Exigiria a API oficial do WhatsApp (custo, número verificado, templates aprovados) e consentimento do cliente final (LGPD). Só depois de validar que os técnicos usam o Chamar.
- Sem e-mail novo (o resumo semanal já cobre), sem histórico de lembretes, sem lembrete em orçamento não aprovado. Não mudar versões fixadas de `next-auth`, `prisma`, `@prisma/client`.

## Relatório final (curto)

Falhas e correções, resultado de cada comando, pendências e o horário do cron escolhido.
