import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { expireStaleQuotes } from "@/lib/quote-expiry";
import { requireUserId } from "@/lib/session";
import { formatBRL } from "@/lib/money";
import { CopyButton } from "@/components/copy-button";
import { buildPixPayload } from "@/lib/pix";
import { PhotoManager } from "@/components/quotes/photo-manager";
import { MaintenanceReminder } from "@/components/quotes/maintenance-reminder";
import { QuoteActions } from "@/components/quotes/quote-actions";
import { StatusBadge } from "@/components/quotes/status-badge";
import { Card, CardContent } from "@/components/ui/card";

const fmtDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });
const fmtDateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUserId();
  await expireStaleQuotes(userId);
  const q = await db.quote.findFirst({
    where: { id, userId },
    include: { items: { orderBy: { position: "asc" } }, photos: { orderBy: { position: "asc" }, select: { id: true } } },
  });
  if (!q) notFound();

  const status = q.status;
  const me = await db.user.findUnique({ where: { id: userId }, select: { name: true, companyName: true, pixKey: true, pixCity: true } });
  const pixPayload =
    status === "APPROVED" && me?.pixKey && me.pixCity
      ? buildPixPayload({ key: me.pixKey, name: me.companyName ?? me.name, city: me.pixCity, amountCents: q.totalCents, txid: `FC${q.number}` })
      : null;

  return (
    <div className="space-y-4 pb-6">
      <Link href="/orcamentos" className="inline-flex min-h-11 items-center text-sm text-muted-foreground">
        ← Orçamentos
      </Link>

      <header className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-semibold">Orçamento #{q.number}</h1>
          <StatusBadge status={status} suffix={status === "APPROVED" && q.paidAt ? " · Pago" : undefined} />
        </div>
        <p className="text-sm">{q.customerName}</p>
        {q.title && <p className="text-sm text-muted-foreground">{q.title}</p>}
        <p className="text-xs text-muted-foreground">
          Criado em {fmtDate.format(q.createdAt)}
          {q.validUntil && ` · válido até ${fmtDate.format(q.validUntil)}`}
        </p>
        {q.viewedAt ? (
          <p className="text-xs text-muted-foreground">Visto em {fmtDateTime.format(q.viewedAt)}</p>
        ) : (
          q.status === "SENT" && <p className="text-xs text-muted-foreground">Ainda não visto</p>
        )}
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

      {q.status === "REJECTED" && q.rejectReason && (
        <p className="rounded-md border p-3 text-sm">
          <span className="font-medium">Motivo da recusa:</span> {q.rejectReason}
        </p>
      )}

      <PhotoManager quoteId={q.id} photos={q.photos} editable={q.status !== "APPROVED"} />

      {q.notes && <p className="whitespace-pre-line text-sm text-muted-foreground">{q.notes}</p>}

      {pixPayload && !q.paidAt && (
        <CopyButton text={pixPayload} label="Copiar Pix copia e cola (para o cliente)" success="Pix copia e cola copiado" className="h-12 w-full" />
      )}

      {q.status === "APPROVED" && (
        <MaintenanceReminder
          quoteId={q.id}
          reminderLabel={q.reminderAt ? fmtDate.format(q.reminderAt) : null}
          done={!!q.reminderDoneAt}
          reminderService={q.reminderService}
        />
      )}

      <QuoteActions quoteId={q.id} publicId={q.publicId} status={q.status} customerPhone={q.customerPhone} paid={!!q.paidAt} />
    </div>
  );
}
