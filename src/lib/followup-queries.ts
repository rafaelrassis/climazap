import type { Prisma } from "@prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;

// Fonte única das regras de "quem cobrar": painel (/inicio) e resumo semanal usam os mesmos filtros.
// lastNudgeAt no futuro = cobrança adiada (ver snoozeQuoteFollowUp).

// SENT sem resposta há 2+ dias, ainda válido e não cobrado nas últimas 48h
export function staleWhere(now: Date): Prisma.QuoteWhereInput {
  const staleSince = new Date(now.getTime() - 2 * DAY_MS);
  return {
    status: "SENT",
    AND: [
      { sentAt: { lte: staleSince } },
      { OR: [{ validUntil: null }, { validUntil: { gt: now } }] },
      { OR: [{ lastNudgeAt: null }, { lastNudgeAt: { lte: staleSince } }] },
    ],
  };
}

// SENT que vence em até 24h e não foi cobrado nas últimas 24h
export function expiringSoonWhere(now: Date): Prisma.QuoteWhereInput {
  return {
    status: "SENT",
    validUntil: { gt: now, lte: new Date(now.getTime() + DAY_MS) },
    OR: [{ lastNudgeAt: null }, { lastNudgeAt: { lte: new Date(now.getTime() - DAY_MS) } }],
  };
}

export function followUpWhere(now: Date): Prisma.QuoteWhereInput {
  return { OR: [staleWhere(now), expiringSoonWhere(now)] };
}
