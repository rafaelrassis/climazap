# FechouClima

Micro-SaaS B2B mobile-first (PWA) para técnicos de ar-condicionado e refrigeração criarem orçamentos em menos de 60s no celular e enviarem por WhatsApp. O cliente abre um link público e aprova com 1 toque, sem login.

Domínio: fechouclima.com.br (repo/pacote continuam `climazap`).

## Stack
Next.js 15 (App Router, React 19) · TypeScript · Tailwind · shadcn/ui · PostgreSQL · Prisma 6 · Auth.js v5 (credentials + bcryptjs) · Zod · npm · Ubuntu.

## Princípios (obrigatórios)
- **Mobile-first rigoroso**: tudo funciona de 360px a 420px. Inputs `h-11`/`h-12` com `text-base` (evita zoom no iOS). Alvos de toque >= 44px. `min-h-dvh` e `env(safe-area-inset-bottom)` em barras fixas.
- **Código pronto para produção**: sem placeholders, sem TODO solto, sem código pela metade.
- **Mutações = Server Actions** em `src/actions/*`. Toda action valida com Zod, chama `requireUserId()` e filtra pelo dono (`where: { id, userId }`).
- **Rotas públicas leves** com `revalidate` e `revalidatePath` nas mutações. Página pública nunca expõe telefone/endereço do cliente nem IDs internos (usar `publicId`).
- **Dinheiro sempre em centavos (`Int`)**. Só `quantity` é `Decimal(10,2)`. Formatar com `formatBRL`.
- **Snapshot**: itens do orçamento copiam descrição/unidade/preço do catálogo na criação. Nunca recalcular orçamento enviado a partir do catálogo.
- **Numeração por técnico**: `User.quoteSeq` incrementado em `$transaction` ao criar `Quote.number`.
- Ordem incremental: banco -> Server Actions -> telas. 1 commit por item do roadmap.

## Estrutura
```
prisma/                 schema.prisma, seed.ts
src/auth.ts             Auth.js (credentials) + rate limit no authorize
src/auth.config.ts      config edge-safe (usada no middleware); PUBLIC_PREFIXES
src/middleware.ts       protege rotas; públicas: /login /cadastro /o/ /api/health /icons /manifest
src/actions/            auth, services, quotes, customers, settings (só funções de ação aqui: exports de "use server" viram endpoints)
src/lib/                brand (paleta), pix (BR Code), quote-pdf (pdf-lib), error-report (alerta por e-mail, via src/instrumentation.ts), password-reset, push (web push), unsubscribe (link assinado), reminders (resumo semanal), db, money, whatsapp, wa-template, session, quote-status, quote-expiry, rate-limit, email, notify, app-icon, validations/
src/app/(auth)          login, cadastro, esqueci-senha, redefinir-senha
src/app/privacidade, termos  páginas legais (LGPD); revisar o texto com um advogado antes de divulgar
src/app/(app)           inicio (dashboard), orcamentos (lista, novo, [id], [id]/editar), servicos, clientes (lista, [id]), ajustes
src/app/o/[publicId]    página pública + aprovar/recusar + opengraph-image + logo + pdf + foto/[photoId]
public/sw.js            service worker (só push)
src/components/         bottom-nav, money-input, logout-button, quotes/, services/, settings/
```
Nota: a rota pública é `/o/[publicId]` (o brief do projeto cita `/p/[token]`; manter `/o/` ou renomear em um commit só, atualizando `PUBLIC_PREFIXES` em `auth.config.ts` e a URL em `sendQuoteViaWhatsApp`).

## Comandos
```
npm run dev
npx prisma migrate dev --name <nome>
npx prisma db seed
npm run lint && npx tsc --noEmit
npm test                # Vitest; integração usa Postgres (TEST_DATABASE_URL, padrão postgresql://postgres:postgres@localhost:5432/climazap_test). O banco precisa ter "test" no nome: o setup apaga o schema.
npm run test:e2e        # 44 testes Playwright (fluxos, formulário, segurança/XSS, layout a 320-430px, acessibilidade axe, PWA, LGPD, cobrança/adiamento) (celular Pixel 5): sobe build na porta 3200 com o banco de teste. Local: PW_CHROMIUM_PATH=<chromium já instalado>
```

## Configuração do Claude Code (`.claude/`)
`settings.json` (permissões seguras e bloqueio de `migrate reset`/`--force-reset`/push forçado), `hooks/session-start.sh` (em sessão na nuvem instala dependências e sobe o Postgres de teste), `commands/` (`/verificar`, `/migrar`, `/e2e`) e `skills/steward` (convenções e armadilhas para PR/CI). Documentos: `README.md`, `DEPLOY.md`, `docs/ROTEIRO-TESTE.md` (teste com os primeiros técnicos).

## Deploy
Ver `DEPLOY.md`. Migrations em `prisma/migrations` (gerar nova: `npx prisma migrate dev --name <nome>`; aplicar em produção: `npx prisma migrate deploy`). Versões de `next-auth`, `prisma` e `@prisma/client` fixadas (exatas).

## Cron
`vercel.json`: segunda 11:00 UTC (8h BRT) chama `/api/cron/lembretes` (resumo semanal) e todo dia 08:00 UTC (5h BRT) `/api/cron/expirar` (SENT vencidos -> EXPIRED), ambos protegidos por `CRON_SECRET` (Bearer, `src/lib/cron-auth.ts`). Rotas públicas no middleware, autenticadas pelo segredo.

## Cobrança (follow-up)
`Quote.lastNudgeAt` esconde o orçamento das listas (passado = cobrado, futuro = adiado); `QuoteNudge` (NUDGE/SNOOZE) é o histórico que alimenta o funil de 30 dias (`src/lib/nudge-funnel.ts`; resumo semanal usa `getNudgeFunnelBatch` para todos os técnicos do lote numa só consulta). Filtros em `src/lib/followup-queries.ts` (painel e resumo semanal usam os mesmos). Mensagem editável em Ajustes (`User.nudgeTemplate`); orçamento que vence em até 24h usa a mensagem de urgência e nunca pode ser adiado. Validado com Postgres real e E2E (`tests/e2e/cobranca.spec.ts`).

## Git
Commitar e enviar direto na `main`, mensagens curtas (Conventional Commits). Nunca commitar `.env`.

## Preferências do Rafael
Português, muito breve, código/comandos primeiro, sem preâmbulo. Em toda tarefa: trazer opiniões/riscos curtos e propor ideias novas. Pode discordar. Avisos de segurança/perda de dados podem ser mais longos.

## Estado atual
Roadmap concluído: cadastro, detalhe/duplicar/editar/renovar/contraproposta, recusar com motivo, expiração na leitura, rate limit (Postgres), serviços com override de preço, aviso por e-mail (Resend), clientes com autocomplete, rascunho em localStorage, template do WhatsApp, OG image, dashboard com "a receber", PWA com service worker só para push (sem cache offline: app autenticado precisa de dado fresco), web push de aprovação/recusa (`web-push`, VAPID), descadastro do resumo por link assinado, editar/excluir cliente e clientes dormentes, navegação inferior, recuperar senha, LGPD (privacidade, termos, aceite, exportar e excluir conta), alerta de erros por e-mail, PDF do orçamento, Pix (BR Code com QR), fotos do orçamento e cor da marca; cobrança (aviso de vencimento, Cobrar/Adiar, funil de 30 dias, modelo de mensagem) e cron de expiração, validados contra Postgres real e E2E.

## Roadmap
Concluído. Ideias para depois: plano pago (limites, cobrança, só com técnicos reais usando); fotos e logo em armazenamento de arquivos se o tráfego crescer; fotos no PDF; Sentry se o alerta por e-mail ficar curto; invalidar sessões ao trocar a senha (hoje o JWT vale até expirar); CSP com nonce; Next 16/Tailwind 4/Prisma 7.

## Riscos conhecidos
- `next-auth@beta` (v5): versão fixada em 5.0.0-beta.32; atualizar com cuidado.
- Prisma fixado em 6.19.3 (7.x muda config/generator).
- Next 15.5.27 (patch de segurança até 15.5.24+). `npm audit` ainda lista só ferramentas de build/dev (postcss embutido no Next processa apenas o nosso CSS, tailwind/braces/chokidar, CLI do prisma, playwright); sem correção sem salto de major (Next 16/Tailwind 4/Prisma 7). `params`, `searchParams` e `headers()` são assíncronos: sempre `await`.
- Sem CSP (Next usa scripts inline; exigiria nonce). Demais cabeçalhos de segurança em `next.config.mjs`.
- `sendQuoteViaWhatsApp` marca `SENT` antes do envio real; aceitável porque a aprovação exige `SENT`.
- Seed nunca deve criar o usuário demo em produção.
- `revalidate = 300` na página pública: a aprovação chama `revalidatePath`, então o status atualiza na hora.
