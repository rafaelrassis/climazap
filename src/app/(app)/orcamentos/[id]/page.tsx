import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { formatBRL } from "@/lib/money";
import { STATUS_LABEL, STATUS_VARIANT } from "@/lib/quote-status";
import { QuoteActions } from "@/components/quotes/quote-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const fmtDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function QuoteDetailPage({ params }: { params: { id: string } }) {
  const userId = await requireUserId();
  const q = await db.quote.findFirst({
    where: { id: params.id, userId },
    include: { items: { orderBy: { position: "asc" } } },
  });
  if (!q) notFound();

  const expired = !!q.validUntil && q.validUntil < new Date();
  const status = q.status === "SENT" && expired ? "EXPIRED" : q.status;

  return (
    <div className="space-y-4 pb-6">
      <Link href="/orcamentos" className="inline-flex min-h-11 items-center text-sm text-muted-foreground">
        ← Orçamentos
      </Link>

      <header className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-semibold">Orçamento #{q.number}</h1>
          <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
        </div>
        <p className="text-sm">{q.customerName}</p>
        {q.title && <p className="text-sm text-muted-foreground">{q.title}</p>}
        <p className="text-xs text-muted-foreground">
          Criado em {fmtDate.format(q.createdAt)}
          {q.validUntil && ` · válido até ${fmtDate.format(q.validUntil)}`}
        </p>
      </header>

      <Card>
        <CardContent className="divide-y p-0">
          {q.items.map((i) => (
            <div key={i.id} className="flex items-start justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium leading-snug">{i.description}</p>
                <p className="text-xs text-muted-foreground">
                  {Number(i.quantity)} {i.unit} × {formatBRL(i.unitPriceCents)}
                </p>
              </div>
              <p className="shrink-0 text-sm font-medium">{formatBRL(i.totalCents)}</p>
            </div>
          ))}
          {q.discountCents > 0 && (
            <div className="flex justify-between p-3 text-sm text-muted-foreground">
              <span>Desconto</span>
              <span>-{formatBRL(q.discountCents)}</span>
            </div>
          )}
          <div className="flex justify-between p-3 font-semibold">
            <span>Total</span>
            <span>{formatBRL(q.totalCents)}</span>
          </div>
        </CardContent>
      </Card>

      {q.notes && <p className="whitespace-pre-line text-sm text-muted-foreground">{q.notes}</p>}

      <QuoteActions quoteId={q.id} publicId={q.publicId} isDraft={q.status === "DRAFT"} />
    </div>
  );
}
