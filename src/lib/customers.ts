import { db } from "@/lib/db";

export type CustomerStats = { quotes: number; approvedCents: number; approvedCount: number };

// Estatísticas por cliente do técnico em uma única consulta agrupada
export async function customerStats(userId: string): Promise<Map<string, CustomerStats>> {
  const rows = await db.quote.groupBy({
    by: ["customerId", "status"],
    where: { userId, customerId: { not: null } },
    _count: true,
    _sum: { totalCents: true },
  });

  const map = new Map<string, CustomerStats>();
  for (const r of rows) {
    if (!r.customerId) continue;
    const s = map.get(r.customerId) ?? { quotes: 0, approvedCents: 0, approvedCount: 0 };
    s.quotes += r._count;
    if (r.status === "APPROVED") {
      s.approvedCents += r._sum.totalCents ?? 0;
      s.approvedCount += r._count;
    }
    map.set(r.customerId, s);
  }
  return map;
}
