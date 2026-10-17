# SPEC 03: invalidar sessões ao redefinir a senha

Leia `CLAUDE.md` (Riscos conhecidos: o JWT vale até expirar, 30 dias). Auth.js v5 beta fixado em 5.0.0-beta.32: não atualizar.

## Objetivo

Depois de redefinir a senha, sessões antigas deixam de funcionar. Mais um botão "Sair de todos os aparelhos" em Ajustes.

## Passo 1: banco

`User.sessionsValidAfter DateTime?`. Migration pelo Prisma (`npx prisma migrate dev --name sessions_valid_after`, banco de teste).

## Passo 2: token e verificação

- `src/auth.config.ts` (edge-safe, sem banco): no callback `jwt`, quando `user` existir (login), gravar `token.issuedAt = Date.now()`; no `session`, expor `session.issuedAt`. Atualizar `src/types/next-auth.d.ts`. Tokens antigos sem `issuedAt` valem como emitidos em `0`: só são revogados se houver `sessionsValidAfter`.
- Função pura `isSessionRevoked(issuedAt: number | undefined, validAfter: Date | null): boolean` em `src/lib/session.ts` (ou arquivo novo em `src/lib/`).
- `requireUserId()` (server): depois de `auth()`, 1 consulta por PK em `User.sessionsValidAfter`; se revogada, tratar como sem sessão (mesmo caminho de hoje para não logado). Fazer o mesmo em `src/app/(app)/layout.tsx` para páginas. O `middleware` continua sem banco.
- Opinião registrada: 1 query por requisição é aceitável nesta escala; se pesar, cachear por 60s.

## Passo 3: actions

- `resetPassword` (`src/actions/auth.ts`) define `sessionsValidAfter = now()` na mesma transação que troca o hash.
- `logoutEverywhere()` em `src/actions/settings.ts`: Zod/`requireUserId`, define `sessionsValidAfter = now()` e encerra a sessão atual. Botão em Ajustes (`src/components/settings/account-section.tsx`) com `AlertDialog` de confirmação, altura ≥ 44px.

## Passo 4: testes

- Unitário: `isSessionRevoked` (sem `issuedAt`, `validAfter` nulo, antes/depois).
- Integração: depois de `resetPassword`, sessão emitida antes é recusada e um login novo funciona. Ler `tests/helpers/setup.ts` para ver como `loginAs` simula a sessão e estender para incluir `issuedAt`.
- E2E curto (`tests/e2e/sessoes.spec.ts`): dois contextos logados; "Sair de todos os aparelhos" no 1º; o 2º é mandado para `/login` ao navegar.

## Critérios de aceite

- [ ] `lint`, `tsc`, `npm test`, `npm run build`, `npm run test:e2e` verdes; sem drift de migration.
- [ ] `CLAUDE.md`: tirar o item dos riscos conhecidos e do roadmap.

## Não fazer

- Não migrar para sessões em banco nem mudar a estratégia JWT. Não derrubar sessões existentes no deploy (campo nulo = tudo vale).

## Relatório final (curto)

Resultado dos comandos e custo observado da consulta extra.
