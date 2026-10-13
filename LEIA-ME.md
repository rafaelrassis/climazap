# Pacote FechouClima: como aplicar

Conteúdo: código completo (schema, seed, auth, actions, telas), `CLAUDE.md`, CI, `.env.example` e `setup.sh`.

## Passo a passo (Ubuntu)

```bash
git clone https://github.com/rafaelrassis/climazap.git
cd climazap
unzip ~/Downloads/climazap-pack.zip -d /tmp
bash /tmp/climazap-pack/setup.sh
```

O `setup.sh` faz:
1. Cria o app Next.js 14 (TS, Tailwind, App Router, `src/`) sem sobrescrever o README do repo.
2. Instala dependências (Prisma 6, next-auth beta, zod, bcryptjs, tsx) e componentes shadcn.
3. Copia `src/`, `prisma/`, `.github/`, `CLAUDE.md`, `.env.example` do pacote.
4. Cria `.env` (se não existir), gera `AUTH_SECRET` e garante `.env` no `.gitignore`.
5. Configura o seed no `package.json`.

Depois, ajuste `DATABASE_URL` no `.env` e rode:

```bash
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
```

Login de teste (só em dev): `demo@fechouclima.com.br` / `demo1234`.

## Commit e push (direto na main)

```bash
git add -A
git commit -m "feat: setup inicial, schema, auth e orçamentos"
git push origin main
```

## Prompt para colar no Claude Code (dentro do repo)

```
Leia o CLAUDE.md. Rode `npm run lint && npx tsc --noEmit` e corrija qualquer erro.
Depois execute o item 1 do roadmap (/cadastro), siga os princípios do CLAUDE.md,
commite e envie na main. Ao final, traga opiniões/riscos curtos e 2 ideias novas.
```

## Checklist antes de produção
- [ ] `AUTH_SECRET`, `DATABASE_URL` (pooler Neon), `DIRECT_URL`, `NEXT_PUBLIC_APP_URL` e `AUTH_TRUST_HOST` (fora da Vercel) configurados
- [x] Rate limit (Postgres, tabela RateLimit)
- [ ] Seed rodado sem criar usuário demo (`NODE_ENV=production`)
- [ ] Repo privado, se o código for diferencial comercial
