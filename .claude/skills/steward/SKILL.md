---
name: steward
description: Convenções do FechouClima para quem mexe em PR, CI ou código deste repositório (como rodar, o que nunca fazer, armadilhas conhecidas).
---

# Guia do repositório

Leia `CLAUDE.md` (princípios e estrutura) antes de mudar código. Resumo do que importa para PR e CI:

## Antes de empurrar
Rodar `/verificar` (lint, tsc, prisma validate, Vitest, build). Mudou tela, rota ou formulário: rodar também o E2E (`/e2e`). A CI faz o mesmo, mais a checagem de drift das migrations.

## Nunca
- Pular, desativar ou "quarentenar" teste para ficar verde. Falha de teste aqui já revelou bug real (aprovação sem aviso, aceite de termos sem validação, corrida de fotos).
- `prisma migrate reset`, `db push --force-reset` ou editar migration já aplicada. Mudança de schema = migration nova (`/migrar`).
- Commitar `.env`, chaves VAPID, `CRON_SECRET` ou qualquer segredo.
- Exportar de `src/actions/*` função que não seja ação: tudo ali vira endpoint público. Helpers vão para `src/lib/`.
- Mostrar telefone, endereço ou IDs internos na página pública, no PDF ou na OG image (usar `publicId`).
- Rodar `pkill -f "next start"` (mata o próprio shell): encerre o PID de `next-server`.

## Convenções
- Server Actions: Zod, `requireUserId()`, filtro por dono (`where: { id, userId }`). Ações públicas (aprovar, recusar, cadastro, recuperar senha) têm rate limit.
- Dinheiro em centavos (`Int`); formatar com `formatBRL`.
- `params`, `searchParams` e `headers()` são assíncronos (Next 15): sempre `await`.
- Mobile-first: nada pode estourar a largura a 320 px; alvos de toque >= 44 px. O E2E `layout.spec.ts` e o de acessibilidade (axe) cobrem isso.
- E-mails guardados e comparados em minúsculas; dados de teste também.
- Commits curtos em Conventional Commits, direto na `main` (preferência do dono do projeto), com as linhas de atribuição pedidas pela sessão.

## Armadilhas já vistas
- `prisma format` cria relações fantasma quando há campo de relação solto: revise o diff do schema.
- Formulários no React 19 limpam os campos depois da ação: devolva os valores digitados no estado da ação.
- Contagem + inserção sem trava dá corrida: use `SELECT ... FOR UPDATE` ou `updateMany` condicional.
- Seletores de teste ambíguos quando o aviso (toast) e o texto da página dizem a mesma coisa: use texto mais específico.
- `import "next-auth"` fora do servidor quebra o Vitest: mocke `@/auth` e `next-auth` nos testes de ação.
