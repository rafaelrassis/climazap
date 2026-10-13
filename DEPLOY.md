# Deploy (Vercel + Neon)

## 1. Banco (Neon)
1. Crie o projeto e copie **duas** URLs: a **pooled** (host com `-pooler`) e a **direta**.
2. Aplique o schema (uma vez, e a cada nova migration), de qualquer máquina com acesso:
   ```bash
   DATABASE_URL="<direta>" DIRECT_URL="<direta>" npx prisma migrate deploy
   DATABASE_URL="<direta>" DIRECT_URL="<direta>" NODE_ENV=production npx prisma db seed   # 9 serviços padrão, sem usuário demo
   ```

## 2. Variáveis na Vercel (Production)
| Variável | Valor |
|---|---|
| `DATABASE_URL` | URL pooled do Neon |
| `DIRECT_URL` | URL direta do Neon |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | `https://fechouclima.com.br` |
| `RESEND_API_KEY` | chave do Resend |
| `EMAIL_FROM` | `FechouClima <avisos@fechouclima.com.br>` (domínio verificado no Resend: SPF + DKIM) |
| `CRON_SECRET` | `openssl rand -hex 32` |

Fora da Vercel, defina também `AUTH_TRUST_HOST=true`.

## 3. Domínio
Adicione `fechouclima.com.br` ao projeto na Vercel e aponte o DNS como ela indicar.

## 4. Conferir depois do deploy
- `https://fechouclima.com.br/api/health` -> `{"ok":true}`
- Criar conta, criar orçamento, abrir o link público em aba anônima e aprovar.
- Segunda-feira seguinte: logs do cron `/api/cron/lembretes` na Vercel.

## Notas
- `postinstall` roda `prisma generate`; `migrate deploy` **não** roda no build (de propósito: migration é passo consciente).
- Next 15.5.27 (inclui as correções de segurança até 15.5.24). O `npm audit` restante é de ferramentas de build/dev, sem correção sem trocar de versão major (Next 16, Tailwind 4, Prisma 7); reavalie a cada trimestre.
