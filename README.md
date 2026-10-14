# FechouClima

Orçamentos de climatização em 60 segundos, direto no WhatsApp. Micro-SaaS mobile-first (PWA) para técnicos de ar-condicionado e refrigeração: o técnico monta o orçamento no celular, envia o link pelo WhatsApp e o cliente aprova com 1 toque, sem login.

**Produção:** https://fechouclima.com.br

## O que faz

**Para o técnico**
- Orçamento em poucos toques: catálogo de serviços com preço próprio, quantidades, desconto, validade e fotos (até 4).
- Envio por WhatsApp com mensagem editável (3 modelos prontos), link público e prévia com valor e logo.
- Acompanhamento: início com aguardando resposta, aprovado no mês, a receber e taxa de aprovação; follow-up de quem não respondeu.
- Aviso quando o cliente aprova ou recusa: notificação no celular (push) e e-mail.
- Clientes com autocomplete, histórico e lista de dormentes para reabordar; lembrete de manutenção em 3, 6 ou 12 meses.
- Editar, duplicar, renovar validade, contraproposta com desconto, marcar como pago.
- Identidade própria: logo e cor da marca; PDF do orçamento; Pix (QR Code e copia e cola) depois da aprovação.
- Resumo semanal por e-mail (com descadastro de um clique).
- LGPD: política e termos, exportar os dados e excluir a conta.

**Para o cliente** (link público, sem login): ver itens, valor e fotos, baixar o PDF, aprovar ou recusar (com motivo) e pagar por Pix.

## Stack

Next.js 15 (App Router, React 19) · TypeScript · Tailwind + shadcn/ui · PostgreSQL (Neon) + Prisma 6 · Auth.js v5 (credentials) · Zod · Resend (e-mail) · web-push · pdf-lib · Vercel.

## Começando

Requisitos: Node 20+, npm e um PostgreSQL.

```bash
git clone https://github.com/rafaelrassis/climazap.git
cd climazap
npm ci
cp .env.example .env        # ajuste DATABASE_URL, DIRECT_URL e gere o AUTH_SECRET: openssl rand -base64 32
npx prisma migrate deploy   # cria as tabelas
npx prisma db seed          # 9 serviços padrão (e um usuário demo, só fora de produção)
npm run dev                 # http://localhost:3000
```

Usuário demo (apenas em desenvolvimento): `demo@fechouclima.com.br` / `demo1234`.

### Variáveis de ambiente

Veja `.env.example`. Obrigatórias: `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`. Opcionais (o recurso fica desligado sem elas): Resend (`RESEND_API_KEY`, `EMAIL_FROM`), alerta de erros (`ERROR_ALERT_EMAIL`), web push (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`) e o cron semanal (`CRON_SECRET`).

## Comandos

```bash
npm run dev            # desenvolvimento
npm run lint && npx tsc --noEmit
npm test               # Vitest: unitários e integração (usa um Postgres de teste)
npm run test:e2e       # Playwright em viewport de celular
npx prisma migrate dev --name <nome>   # nova migration
```

### Testes

- **Vitest** (135 testes): regras de negócio, concorrência, rate limit, Pix/BR Code, PDF, LGPD, cron. Os de integração usam um Postgres de verdade em `TEST_DATABASE_URL` (padrão `postgresql://postgres:postgres@localhost:5432/climazap_test`). O nome do banco precisa conter `test`, porque o setup recria o schema.
- **Playwright** (42 testes): fluxos completos, formulário, segurança (XSS, login), acessibilidade (axe), layout sem estouro a 320, 360, 390 e 430 px, PWA e LGPD. Localmente, aponte `PW_CHROMIUM_PATH` para um Chromium já instalado.
- A CI roda tudo e confere que as migrations aplicam sem drift.

## Estrutura

```
prisma/                 schema, migrations e seed
src/actions/            Server Actions (mutações)
src/lib/                regras de negócio e utilitários
src/app/(auth)          login, cadastro, recuperar senha
src/app/(app)           área do técnico (início, orçamentos, clientes, serviços, ajustes)
src/app/o/[publicId]    página pública do orçamento (aprovar, PDF, fotos, OG image)
tests/                  unit, integration e e2e
public/sw.js            service worker (somente push)
```

Detalhes de arquitetura, princípios e riscos conhecidos em [`CLAUDE.md`](CLAUDE.md).

## Deploy

Vercel + Neon. Passo a passo em [`DEPLOY.md`](DEPLOY.md). Para colocar os primeiros técnicos em teste: [`docs/ROTEIRO-TESTE.md`](docs/ROTEIRO-TESTE.md).

## Segurança e privacidade

- Todo acesso a dados filtra pelo dono; a página pública usa `publicId` e nunca mostra telefone ou endereço do cliente.
- Rate limit em login, cadastro, recuperação de senha e ações públicas; senhas com bcrypt; tokens de recuperação guardados só como hash e de uso único.
- Cabeçalhos de segurança, sem CSP por enquanto (ver `CLAUDE.md`).
- Os textos de `/privacidade` e `/termos` são um modelo: revise com um advogado antes de divulgar.
