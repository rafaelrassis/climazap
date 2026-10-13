import { db } from "@/lib/db";

export type CustomerStats = { quotes: number; approvedCents: number; approvedCount: number; lastQuoteAt: Date | null };

export const DORMANT_DAYS = 180;

// Estatísticas por cliente do técnico em uma única consulta agrupada
export async function customerStats(userId: string): Promise<Map<string, CustomerStats>> {
  const rows = await db.quote.groupBy({
    by: ["customerId", "status"],
    where: { userId, customerId: { not: null } },
    _count: true,
    _sum: { totalCents: true },
    _max: { createdAt: true },
  });

  const map = new Map<string, CustomerStats>();
  for (const r of rows) {
    if (!r.customerId) continue;
    const s = map.get(r.customerId) ?? { quotes: 0, approvedCents: 0, approvedCount: 0, lastQuoteAt: null };
    s.quotes += r._count;
    const last = r._max.createdAt;
    if (last && (!s.lastQuoteAt || last > s.lastQuoteAt)) s.lastQuoteAt = last;
    if (r.status === "APPROVED") {
      s.approvedCents += r._sum.totalCents ?? 0;
      s.approvedCount += r._count;
    }
    map.set(r.customerId, s);
  }
  return map;
}

// Dormente: sem orçamento há DORMANT_DAYS dias (ou nunca teve e foi cadastrado há esse tempo)
export function isDormant(stats: CustomerStats | undefined, createdAt: Date, now = new Date()): boolean {
  const last = stats?.lastQuoteAt ?? createdAt;
  return now.getTime() - last.getTime() > DORMANT_DAYS * 86_400_000;
}
