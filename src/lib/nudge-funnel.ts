import { db } from "@/lib/db";

const DAY_MS = 24 * 60 * 60 * 1000;

export type NudgeFunnel = { nudged: number; approvedAfter: number; approvedCents: number };

// Funil de cobrança dos últimos 30 dias, a partir do histórico (QuoteNudge, kind NUDGE; adiamentos não contam).
// Um orçamento cobrado várias vezes conta uma vez; "aprovou depois" = aprovado depois da primeira cobrança da janela.
// Correlação, não causa: o cliente pode ter aprovado sozinho.
export async function getNudgeFunnel(userId: string, now = new Date()): Promise<NudgeFunnel> {
  const nudges = await db.quoteNudge.findMany({
    where: { userId, kind: "NUDGE", createdAt: { gte: new Date(now.getTime() - 30 * DAY_MS), lte: now } },
    orderBy: { createdAt: "asc" },
    take: 2000,
    select: { quoteId: true, createdAt: true, quote: { select: { status: true, totalCents: true, respondedAt: true } } },
  });

  const first = new Map<string, (typeof nudges)[number]>();
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
