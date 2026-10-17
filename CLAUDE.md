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
npm run test:e2e        # 47 testes Playwright (fluxos, formulário, segurança/XSS, layout a 320-430px, acessibilidade axe, PWA, LGPD) (celular Pixel 5): sobe build na porta 3200 com o banco de teste. Local: PW_CHROMIUM_PATH=<chromium já instalado>
npm run metricas        # Só leitura: ativação/retenção por coorte, funil enviado->visto->aprovado, efeito da cobrança (ver DEPLOY.md)
```

## Configuração do Claude Code (`.claude/`)
`settings.json` (permissões seguras e bloqueio de `migrate reset`/`--force-reset`/push forçado), `hooks/session-start.sh` (em sessão na nuvem instala dependências e sobe o Postgres de teste), `commands/` (`/verificar`, `/migrar`, `/e2e`) e `skills/steward` (convenções e armadilhas para PR/CI). Documentos: `README.md`, `DEPLOY.md`, `docs/ROTEIRO-TESTE.md` (teste com os primeiros técnicos).

## Deploy
Ver `DEPLOY.md`. Migrations em `prisma/migrations` (gerar nova: `npx prisma migrate dev --name <nome>`; aplicar em produção: `npx prisma migrate deploy`). Versões de `next-auth`, `prisma` e `@prisma/client` fixadas (exatas).

## Cron
`vercel.json`: segunda 11:00 UTC (8h BRT) chama `/api/cron/lembretes` (resumo semanal) e todo dia 08:00 UTC (5h BRT) `/api/cron/expirar` (SENT vencidos -> EXPIRED), ambos protegidos por `CRON_SECRET` (Bearer, `src/lib/cron-auth.ts`). Rotas públicas no middleware, autenticadas pelo segredo.

## Cobrança (follow-up)
`Quote.lastNudgeAt` esconde o orçamento das listas (passado = cobrado, futuro = adiado); `QuoteNudge` (NUDGE/SNOOZE) é o histórico que alimenta o funil de 30 dias. Filtros em `src/lib/followup-queries.ts` (painel e resumo semanal usam os mesmos). Mensagem editável em Ajustes (`User.nudgeTemplate`); orçamento que vence em até 24h usa a mensagem de urgência.

`Quote.viewedAt` registra a 1ª abertura do link público pelo cliente: beacon client-side (`src/components/quotes/view-beacon.tsx`, chamado em `/o/[publicId]`) chama `markQuoteViewed`, porque a página pública tem cache (`revalidate = 300`) e não pode gravar no render do servidor. `viewedLabel` (`src/lib/followup.ts`) mostra "visto"/"não abriu o link" em `/orcamentos`, `/inicio` e no resumo semanal; o detalhe (`/orcamentos/[id]`) mostra "Visto em DD/MM HH:mm". Precedência da mensagem de cobrança: urgência (vence em até 24h) > modelo próprio do técnico (`nudgeTemplate`) > variante por visto (`NOT_VIEWED_NUDGE_TEMPLATE`, só quando não há modelo próprio). Editar o orçamento enviado (volta para `DRAFT`) zera `viewedAt`.

## Sessões
`User.sessionsValidAfter DateTime?` + `token.issuedAt`/`session.issuedAt` (gravado só no login, em `src/auth.config.ts`). `isSessionRevoked` (`src/lib/session-revoked.ts`) compara os dois; `requireUserId`/`getUserId` (`src/lib/session.ts`) consultam `sessionsValidAfter` por PK a cada chamada (1 query extra por requisição). `resetPassword` e `logoutEverywhere` (Ajustes > "Sair de todos os aparelhos") gravam `sessionsValidAfter = now()`. O middleware não consulta banco (edge, sem Prisma): o cookie/JWT continua "válido" para ele mesmo depois de revogado. Por isso `requireUserId` usa `redirect()` (não `throw`) quando não há sessão válida — Next busca os dados do layout e da página em paralelo, então a página também chega a essa checagem de forma independente do redirect do layout; um `throw` normal apareceria como erro de servidor (e disparava o alerta por e-mail) mesmo com o redirect funcionando. O redirect vai para `/api/auth/sessao-revogada` (fora do matcher do middleware, em `/api/auth/*`), que faz um `signOut` de verdade (limpa o cookie) antes de ir para `/login` — só redirecionar para `/login` sem limpar o cookie cria um loop, porque o middleware vê o cookie como logado e manda de volta para `/inicio`.

## Indicação
`User.referralCode` (6 caracteres, gerado sob demanda no 1º acesso a Ajustes por `ensureReferralCode`, com retry em colisão) e `User.referredById` (`onDelete: SetNull`: excluir quem indicou não apaga o indicado). `registerAction` aceita `ref` opcional; código inexistente ou malformado é ignorado em silêncio (não bloqueia o cadastro, não revela se o código existe). Sem recompensa: só rastreio, para medir se o boca a boca funciona (`referrals()` em `src/lib/metrics.ts`, incluído no `npm run metricas`).

## Git
Commitar e enviar direto na `main`, mensagens curtas (Conventional Commits). Nunca commitar `.env`.

## Preferências do Rafael
Português, muito breve, código/comandos primeiro, sem preâmbulo. Em toda tarefa: trazer opiniões/riscos curtos e propor ideias novas. Pode discordar. Avisos de segurança/perda de dados podem ser mais longos.

## Estado atual
Roadmap concluído: cadastro, detalhe/duplicar/editar/renovar/contraproposta, recusar com motivo, expiração na leitura, rate limit (Postgres), serviços com override de preço, aviso por e-mail (Resend), clientes com autocomplete, rascunho em localStorage, template do WhatsApp, OG image, dashboard com "a receber", PWA com service worker só para push (sem cache offline: app autenticado precisa de dado fresco), web push de aprovação/recusa (`web-push`, VAPID), descadastro do resumo por link assinado, editar/excluir cliente e clientes dormentes, navegação inferior, recuperar senha, LGPD (privacidade, termos, aceite, exportar e excluir conta), alerta de erros por e-mail, PDF do orçamento, Pix (BR Code com QR), fotos do orçamento, cor da marca, "visto" (SPEC-01: `viewedAt`, selo no painel e variante de cobrança para quem nunca abriu o link), métricas de validação (SPEC-02: `npm run metricas`, só leitura), sessões (SPEC-03: redefinir a senha ou "Sair de todos os aparelhos" invalida sessões antigas) e indicação entre técnicos (SPEC-04: link de convite em Ajustes, sem recompensa).

## Roadmap
Concluído. Ideias para depois: plano pago (limites, cobrança, só com técnicos reais usando); fotos e logo em armazenamento de arquivos se o tráfego crescer; fotos no PDF; Sentry se o alerta por e-mail ficar curto; CSP com nonce; Next 16/Tailwind 4/Prisma 7.

## Riscos conhecidos
- `next-auth@beta` (v5): versão fixada em 5.0.0-beta.32; atualizar com cuidado.
- Prisma fixado em 6.19.3 (7.x muda config/generator).
- Next 15.5.27 (patch de segurança até 15.5.24+). `npm audit` ainda lista só ferramentas de build/dev (postcss embutido no Next processa apenas o nosso CSS, tailwind/braces/chokidar, CLI do prisma, playwright); sem correção sem salto de major (Next 16/Tailwind 4/Prisma 7). `params`, `searchParams` e `headers()` são assíncronos: sempre `await`.
- Sem CSP (Next usa scripts inline; exigiria nonce). Demais cabeçalhos de segurança em `next.config.mjs`.
- `sendQuoteViaWhatsApp` marca `SENT` antes do envio real; aceitável porque a aprovação exige `SENT`.
- Seed nunca deve criar o usuário demo em produção.
- `revalidate = 300` na página pública: a aprovação chama `revalidatePath`, então o status atualiza na hora.
- `markQuoteViewed` usa o mesmo rate limit (`public:<ip>`, 20/10min) de aprovar/recusar, por especificação da SPEC-01. Cliente que recarrega a página várias vezes consome do mesmo orçamento; vários clientes atrás do mesmo IP (CGNAT/proxy corporativo) dividem o limite entre visualizar e aprovar. Aceitável por ora (baixo tráfego), mas vale um bucket próprio para visualização se isso incomodar.
