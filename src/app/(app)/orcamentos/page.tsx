import Link from "next/link";
import { db } from "@/lib/db";
import { expireStaleQuotes } from "@/lib/quote-expiry";
import { requireUserId } from "@/lib/session";
import { formatBRL } from "@/lib/money";
import { StatusBadge } from "@/components/quotes/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function OrcamentosPage() {
  const userId = await requireUserId();
  await expireStaleQuotes(userId);
  const quotes = await db.quote.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, publicId: true, number: true, customerName: true, status: true, totalCents: true },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Orçamentos</h1>
        <Button asChild className="h-11">
          <Link href="/orcamentos/novo">Novo</Link>
        </Button>
      </div>

      {quotes.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">Nenhum orçamento ainda.</p>
      )}

      {quotes.map((q) => (
        <Link key={q.id} href={`/orcamentos/${q.id}`} className="block">
          <Card>
            <CardContent className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  #{q.number} · {q.customerName}
                </p>
                <StatusBadge status={q.status} className="mt-1" />
              </div>
              <p className="shrink-0 text-sm font-semibold">{formatBRL(q.totalCents)}</p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
