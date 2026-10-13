import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { STATUS_LABEL, STATUS_VARIANT } from "@/lib/quote-status";
import { RejectButton } from "@/components/quotes/reject-button";
import { ApproveButton } from "@/components/quotes/approve-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const revalidate = 300;
const baseMeta: Metadata = { title: "Orçamento", robots: { index: false, follow: false } };

export async function generateMetadata({ params }: { params: { publicId: string } }): Promise<Metadata> {
  if (!/^[0-9a-f-]{36}$/i.test(params.publicId)) return baseMeta;
  const q = await db.quote.findUnique({
    where: { publicId: params.publicId },
    select: { number: true, totalCents: true, user: { select: { name: true, companyName: true } } },
  });
  if (!q) return baseMeta;
  const sender = q.user.companyName ?? q.user.name;
  return {
    ...baseMeta,
    title: `Orçamento #${q.number} · ${sender}`,
    description: `Orçamento de ${formatBRL(q.totalCents)}. Veja os detalhes e aprove com 1 toque.`,
  };
}

const fmtDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function PublicQuotePage({ params }: { params: { publicId: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.publicId)) notFound();

  const q = await db.quote.findUnique({
    where: { publicId: params.publicId },
    select: {
      number: true,
      customerName: true,
      title: true,
      notes: true,
      status: true,
      discountCents: true,
      totalCents: true,
      validUntil: true,
      respondedAt: true,
      rejectReason: true,
      user: { select: { name: true, companyName: true } },
      items: {
        orderBy: { position: "asc" },
        select: { id: true, description: true, unit: true, quantity: true, unitPriceCents: true, totalCents: true },
      },
    },
  });
  if (!q) notFound();

  const expired = !!q.validUntil && q.validUntil < new Date();
  const status = q.status === "SENT" && expired ? "EXPIRED" : q.status;
  const canApprove = status === "SENT";

  return (
    <main className="mx-auto min-h-dvh max-w-lg space-y-4 px-4 py-6 pb-32">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">{q.user.companyName ?? q.user.name}</p>
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">Orçamento #{q.number}</h1>
          <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
        </div>
        <p className="text-sm">Para {q.customerName}</p>
        {q.title && <p className="text-sm text-muted-foreground">{q.title}</p>}
      </header>

      <Card>
        <CardContent className="divide-y p-0">
          {q.items.map((i) => (
            <div key={i.id} className="flex items-start justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium leading-snug">{i.description}</p>
                <p className="text-xs text-muted-foreground">
                  {Number(i.quantity).toLocaleString("pt-BR")} {i.unit} × {formatBRL(i.unitPriceCents)}
                </p>
              </div>
              <p className="shrink-0 text-sm font-semibold">{formatBRL(i.totalCents)}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-1 px-1">
        {q.discountCents > 0 && (
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Desconto</span>
            <span>-{formatBRL(q.discountCents)}</span>
          </div>
        )}
        <div className="flex justify-between text-lg font-bold">
          <span>Total</span>
          <span>{formatBRL(q.totalCents)}</span>
        </div>
        {q.validUntil && <p className="text-xs text-muted-foreground">Válido até {fmtDate.format(q.validUntil)}</p>}
      </div>

      {q.notes && <p className="whitespace-pre-line rounded-md border p-3 text-sm">{q.notes}</p>}

      {status === "APPROVED" && (
        <p className="rounded-md border p-3 text-sm font-medium">
          Aprovado{q.respondedAt ? ` em ${fmtDate.format(q.respondedAt)}` : ""}. Obrigado!
        </p>
      )}

      {status === "DRAFT" && (
        <p className="rounded-md border p-3 text-sm">
          Este orçamento está sendo atualizado. Aguarde o novo link do técnico.
        </p>
      )}

      {status === "REJECTED" && (
        <p className="rounded-md border p-3 text-sm">Orçamento recusado{q.respondedAt ? ` em ${fmtDate.format(q.respondedAt)}` : ""}.</p>
      )}

      {canApprove && (
        <div className="fixed inset-x-0 bottom-0 border-t bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto max-w-lg space-y-1">
            <ApproveButton publicId={params.publicId} totalLabel={formatBRL(q.totalCents)} />
            <RejectButton publicId={params.publicId} />
          </div>
        </div>
      )}
    </main>
  );
}
