# Specs para o Claude Code (executar em sequência)

Para cada spec: `Leia CLAUDE.md e docs/specs/SPEC-0X-....md e execute.` Só passe para a próxima com tudo verde (`npm run lint && npx tsc --noEmit && npm test && npm run build`, e `npm run test:e2e` quando a spec mandar).

| # | Spec | Por que agora |
|---|---|---|
| 0 | `SPEC-validar-cobranca.md` | Já executada (E2E de cobrar/adiar passou) |
| 1 | `SPEC-01-visto.md` | Saber se o cliente abriu o link muda a cobrança: "não abriu" e "abriu e não respondeu" são problemas diferentes |
| 2 | `SPEC-02-metricas.md` | Sem cobrança, a pergunta é retenção. Script de leitura, sem tabela de eventos nova |
| 3 | `SPEC-03-sessoes.md` | Risco conhecido: JWT continua válido depois de redefinir a senha |
| 4 | `SPEC-04-indicacao.md` | Canal de aquisição barato; só rastreia, sem recompensa até existir cobrança |

Fora do roadmap (decisão): `sendQuoteViaWhatsApp` marcar `SENT` antes do envio real não tem correção confiável (o app não sabe se o técnico apertou "enviar" no WhatsApp). Mantido como risco aceito; o "visto" da SPEC-01 compensa, porque mostra quem nunca abriu o link.
