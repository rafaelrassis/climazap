import { db } from "@/lib/db";

const DAY_MS = 24 * 60 * 60 * 1000;

export type NudgeFunnel = { nudged: number; approvedAfter: number; approvedCents: number };

type NudgeRow = { userId: string; quoteId: string; createdAt: Date; quote: { status: string; totalCents: number; respondedAt: Date | null } };

function summarize(nudges: NudgeRow[]): NudgeFunnel {
  const first = new Map<string, NudgeRow>();
  for (const n of nudges) if (!first.has(n.quoteId)) first.set(n.quoteId, n);

  let approvedAfter = 0;
  let approvedCents = 0;
  for (const n of first.values()) {
    if (n.quote.status === "APPROVED" && n.quote.respondedAt && n.quote.respondedAt > n.createdAt) {
      approvedAfter++;
      approvedCents += n.quote.totalCents;
    }
  }
  return { nudged: first.size, approvedAfter, approvedCents };
}

// Funil de cobrança dos últimos 30 dias, a partir do histórico (QuoteNudge, kind NUDGE; adiamentos não contam).
// Um orçamento cobrado várias vezes conta uma vez; "aprovou depois" = aprovado depois da primeira cobrança da janela.
// Correlação, não causa: o cliente pode ter aprovado sozinho.
export async function getNudgeFunnel(userId: string, now = new Date()): Promise<NudgeFunnel> {
  const nudges = await db.quoteNudge.findMany({
    where: { userId, kind: "NUDGE", createdAt: { gte: new Date(now.getTime() - 30 * DAY_MS), lte: now } },
    orderBy: { createdAt: "asc" },
    take: 2000,
    select: { userId: true, quoteId: true, createdAt: true, quote: { select: { status: true, totalCents: true, respondedAt: true } } },
  });
  return summarize(nudges);
}

// Mesmo funil, para vários técnicos numa só consulta (resumo semanal em lote).
export async function getNudgeFunnelBatch(userIds: string[], now = new Date()): Promise<Map<string, NudgeFunnel>> {
  const result = new Map<string, NudgeFunnel>();
  if (userIds.length === 0) return result;

  const nudges = await db.quoteNudge.findMany({
    where: { userId: { in: userIds }, kind: "NUDGE", createdAt: { gte: new Date(now.getTime() - 30 * DAY_MS), lte: now } },
    orderBy: { createdAt: "asc" },
    take: 20_000,
    select: { userId: true, quoteId: true, createdAt: true, quote: { select: { status: true, totalCents: true, respondedAt: true } } },
  });

  const byUser = new Map<string, NudgeRow[]>();
  for (const n of nudges) {
    const rows = byUser.get(n.userId);
    if (rows) rows.push(n);
    else byUser.set(n.userId, [n]);
  }

  for (const userId of userIds) result.set(userId, summarize(byUser.get(userId) ?? []));
  return result;
}
