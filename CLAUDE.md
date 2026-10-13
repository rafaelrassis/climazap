# FechouClima

Micro-SaaS B2B mobile-first (PWA) para técnicos de ar-condicionado e refrigeração criarem orçamentos em menos de 60s no celular e enviarem por WhatsApp. O cliente abre um link público e aprova com 1 toque, sem login.

Domínio: fechouclima.com.br (repo/pacote continuam `climazap`).

## Stack
Next.js 14 (App Router) · TypeScript · Tailwind · shadcn/ui · PostgreSQL · Prisma 6 · Auth.js v5 (credentials + bcryptjs) · Zod · npm · Ubuntu.

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
src/auth.ts             Auth.js (credentials)
src/auth.config.ts      config edge-safe (usada no middleware)
src/middleware.ts       protege rotas; públicas: /login /cadastro /o/ /api/health
src/actions/            auth.ts, services.ts, quotes.ts
src/lib/                db, money, whatsapp, session, quote-status, validations/
src/app/(auth)/login    login (cadastro: a fazer)
src/app/(app)           área logada: orcamentos (servicos: a fazer)
src/app/o/[publicId]    página pública do orçamento + aprovação com modal
src/components/quotes   quote-form, approve-button
```
Nota: a rota pública é `/o/[publicId]` (o brief do projeto cita `/p/[token]`; manter `/o/` ou renomear em um commit só, atualizando `PUBLIC_PREFIXES` em `auth.config.ts` e a URL em `sendQuoteViaWhatsApp`).

## Comandos
```
npm run dev
npx prisma migrate dev --name <nome>
npx prisma db seed
npm run lint && npx tsc --noEmit
```

## Git
Commitar e enviar direto na `main`, mensagens curtas (Conventional Commits). Nunca commitar `.env`.

## Preferências do Rafael
Português, muito breve, código/comandos primeiro, sem preâmbulo. Em toda tarefa: trazer opiniões/riscos curtos e propor ideias novas. Pode discordar. Avisos de segurança/perda de dados podem ser mais longos.

## Estado atual
Pronto: schema, seed (9 serviços padrão + usuário demo só fora de produção), actions de services/quotes (criar, enviar via WhatsApp, aprovar por publicId), Auth.js, login, listagem, `/orcamentos/novo`, página pública com modal de confirmação.

## Roadmap (nesta ordem)
9. **Customer**: tabela de clientes com autocomplete no formulário.
10. **Rascunho do formulário em `localStorage`**.
11. **Template editável da mensagem do WhatsApp** (`User.waTemplate` com `{cliente}`, `{valor}`, `{link}`).
12. **OG image / PDF** do orçamento (`opengraph-image.tsx`).
13. **Dashboard**: pendentes, aprovados e valor a receber (requisito do MVP).
14. **PWA**: manifest + ícones + instalável.

## Riscos conhecidos
- `next-auth@beta` (v5): fixar versão exata no `package.json`.
- Prisma fixado em 6.x (7.x muda config/generator).
- `sendQuoteViaWhatsApp` marca `SENT` antes do envio real; aceitável porque a aprovação exige `SENT`.
- Seed nunca deve criar o usuário demo em produção.
- `revalidate = 300` na página pública: a aprovação chama `revalidatePath`, então o status atualiza na hora.
