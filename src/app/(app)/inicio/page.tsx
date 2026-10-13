import Link from "next/link";
import { db } from "@/lib/db";
import { expireStaleQuotes } from "@/lib/quote-expiry";
import { requireUserId } from "@/lib/session";
import { formatBRL } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Início" };

const BR_OFFSET_MS = 3 * 60 * 60 * 1000; // America/Sao_Paulo = UTC-3 (sem horário de verão)
const DAY_MS = 24 * 60 * 60 * 1000;

function monthStartBR(now: Date) {
  const br = new Date(now.getTime() - BR_OFFSET_MS);
  return new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), 1) + BR_OFFSET_MS);
}

function Stat({ label, value, hint, href }: { label: string; value: string; hint: string; href: string }) {
  return (
    <Link href={href} className="block">
      <Card className="h-full">
        <CardContent className="space-y-1 p-3">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold leading-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default async function InicioPage() {
  const userId = await requireUserId();
  await expireStaleQuotes(userId);

  const now = new Date();
  const monthStart = monthStartBR(now);
  const since30 = new Date(now.getTime() - 30 * DAY_MS);
  const staleSince = new Date(now.getTime() - 2 * DAY_MS);

  const [pending, approvedMonth, receivable, answered30, approved30, stale] = await Promise.all([
    db.quote.aggregate({ where: { userId, status: "SENT" }, _count: true, _sum: { totalCents: true } }),
    db.quote.aggregate({
      where: { userId, status: "APPROVED", respondedAt: { gte: monthStart } },
      _count: true,
      _sum: { totalCents: true },
    }),
    db.quote.aggregate({
      where: { userId, status: "APPROVED", paidAt: null },
      _count: true,
      _sum: { totalCents: true },
    }),
    db.quote.count({ where: { userId, sentAt: { gte: since30 }, status: { in: ["APPROVED", "REJECTED", "EXPIRED", "SENT"] } } }),
    db.quote.count({ where: { userId, sentAt: { gte: since30 }, status: "APPROVED" } }),
    db.quote.findMany({
      where: { userId, status: "SENT", sentAt: { lte: staleSince } },
      orderBy: { sentAt: "asc" },
      take: 5,
      select: { id: true, number: true, customerName: true, totalCents: true, sentAt: true },
    }),
  ]);

  const rate = answered30 > 0 ? Math.round((approved30 / answered30) * 100) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Início</h1>
        <Button asChild className="h-11">
          <Link href="/orcamentos/novo">Novo orçamento</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat
          label="Aguardando resposta"
          value={formatBRL(pending._sum.totalCents ?? 0)}
          hint={plural(pending._count, "orçamento", "orçamentos")}
          href="/orcamentos"
        />
        <Stat
          label="Aprovado no mês"
          value={formatBRL(approvedMonth._sum.totalCents ?? 0)}
          hint={plural(approvedMonth._count, "orçamento", "orçamentos")}
          href="/orcamentos"
        />
        <Stat
          label="A receber"
          value={formatBRL(receivable._sum.totalCents ?? 0)}
          hint={plural(receivable._count, "aprovado não pago", "aprovados não pagos")}
          href="/orcamentos"
        />
        <Stat
          label="Taxa de aprovação"
          value={rate === null ? "—" : `${rate}%`}
          hint="enviados nos últimos 30 dias"
          href="/orcamentos"
        />
      </div>

      {stale.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Sem resposta há mais de 2 dias</h2>
          {stale.map((q) => (
            <Link key={q.id} href={`/orcamentos/${q.id}`} className="block">
              <Card>
                <CardContent className="flex min-h-11 items-center justify-between gap-3 p-3">
                  <p className="min-w-0 truncate text-sm">
                    #{q.number} · {q.customerName}
                  </p>
                  <p className="shrink-0 text-sm font-semibold">{formatBRL(q.totalCents)}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
