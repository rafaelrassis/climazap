---
description: Cria uma migration do Prisma de forma segura, sem tocar em banco de produção
---
Para a mudança de schema pedida em `$ARGUMENTS`:

1. Edite `prisma/schema.prisma` e rode `npx prisma format && npx prisma validate`. Confira se o `format` não inventou relações que você não escreveu (já aconteceu: ele cria o lado oposto de uma relação solta).
2. Suba um banco descartável com as migrations atuais:
   `su postgres -c "psql -c 'DROP DATABASE IF EXISTS climazap_mig'"; su postgres -c "psql -c 'CREATE DATABASE climazap_mig'"`
   `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/climazap_mig DIRECT_URL=<mesma> npx prisma migrate deploy`
3. Gere o SQL **sem banco de dados em risco**: `npx prisma migrate diff --from-url <climazap_mig> --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/<AAAAMMDDHHMMSS>_<nome>/migration.sql`
4. Aplique de novo no banco descartável e confirme **sem drift**: `... migrate diff --from-url <climazap_mig> --to-schema-datamodel prisma/schema.prisma --exit-code`
5. `npx prisma generate`, atualize `tests/helpers/db.ts` (lista do `TRUNCATE`) se houver tabela nova, e rode `/verificar`.

Nunca use `migrate reset` nem `db push --force-reset` (o Prisma bloqueia agentes e, em produção, apagaria dados). Em produção só `npx prisma migrate deploy`.
