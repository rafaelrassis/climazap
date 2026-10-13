import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { customerStats } from "@/lib/customers";
import { formatBRL } from "@/lib/money";
import { STATUS_LABEL, STATUS_VARIANT } from "@/lib/quote-status";
import { requireUserId } from "@/lib/session";
import { buildWhatsAppUrl, normalizeBrPhone } from "@/lib/whatsapp";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const fmtDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function ClienteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUserId();
  const customer = await db.customer.findFirst({
    where: { id, userId },
    include: {
      quotes: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, number: true, status: true, totalCents: true, createdAt: true },
      },
    },
  });
  if (!customer) notFound();

  const stats = (await customerStats(userId)).get(customer.id);

  return (
    <div className="space-y-4">
      <Link href="/clientes" className="inline-flex min-h-11 items-center text-sm text-muted-foreground">
        ← Clientes
      </Link>

      <header className="space-y-1">
        <h1 className="text-lg font-semibold">{customer.name}</h1>
        {customer.address && <p className="text-sm text-muted-foreground">{customer.address}</p>}
        <p className="text-sm text-muted-foreground">
          {stats?.approvedCount ?? 0} aprovado(s) · {formatBRL(stats?.approvedCents ?? 0)} no total
        </p>
      </header>

      <div className="space-y-2">
        <Button asChild className="h-12 w-full text-base">
          <Link href={`/orcamentos/novo?cliente=${customer.id}`}>Novo orçamento</Link>
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button asChild variant="outline" className="h-11">
            <a href={buildWhatsAppUrl(customer.phone, "")}>WhatsApp</a>
          </Button>
          <Button asChild variant="outline" className="h-11">
            <a href={`tel:+${normalizeBrPhone(customer.phone)}`}>Ligar</a>
          </Button>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Orçamentos</h2>
        {customer.quotes.length === 0 && <p className="text-sm text-muted-foreground">Nenhum orçamento vinculado.</p>}
        {customer.quotes.map((q) => (
          <Link key={q.id} href={`/orcamentos/${q.id}`} className="block">
            <Card>
              <CardContent className="flex min-h-11 items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    #{q.number} · {fmtDate.format(q.createdAt)}
                  </p>
                  <Badge variant={STATUS_VARIANT[q.status]} className="mt-1">
                    {STATUS_LABEL[q.status]}
                  </Badge>
                </div>
                <p className="shrink-0 text-sm font-semibold">{formatBRL(q.totalCents)}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
