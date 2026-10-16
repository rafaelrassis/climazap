import { db } from "@/lib/db";

const DAY_MS = 24 * 60 * 60 * 1000;

export type NudgeFunnel = { nudged: number; approvedAfter: number; approvedCents: number };

// Funil de cobrança dos últimos 30 dias: orçamentos cobrados e quantos foram aprovados depois da cobrança.
// Limites: lastNudgeAt guarda só a última cobrança; um adiamento antigo (data já passada) conta como cobrança.
export async function getNudgeFunnel(userId: string, now = new Date()): Promise<NudgeFunnel> {
  const rows = await db.quote.findMany({
    where: { userId, lastNudgeAt: { gte: new Date(now.getTime() - 30 * DAY_MS), lte: now } },
    take: 500,
    select: { status: true, totalCents: true, respondedAt: true, lastNudgeAt: true },
  });
  const won = rows.filter((q) => q.status === "APPROVED" && q.respondedAt && q.lastNudgeAt && q.respondedAt > q.lastNudgeAt);
  return {
    nudged: rows.length,
    approvedAfter: won.length,
    approvedCents: won.reduce((sum, q) => sum + q.totalCents, 0),
  };
}
