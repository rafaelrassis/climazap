import { notFound } from "next/navigation";
import { listCustomers } from "@/actions/customers";
import { listServices } from "@/actions/services";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { QuoteForm } from "@/components/quotes/quote-form";

const VALID_OPTIONS = [3, 7, 15, 30];

export default async function EditarOrcamentoPage({ params }: { params: { id: string } }) {
  const userId = await requireUserId();
  const [q, services, customers] = await Promise.all([
    db.quote.findFirst({
      where: { id: params.id, userId, status: { not: "APPROVED" } },
      include: { items: { orderBy: { position: "asc" } } },
    }),
    listServices(),
    listCustomers(),
  ]);
  if (!q) notFound();

  // Itens antigos mantêm o snapshot; a validade é recalculada a partir de hoje
  const days = q.validUntil && q.createdAt ? Math.round((q.validUntil.getTime() - q.createdAt.getTime()) / 86_400_000) : 7;
  const validDays = VALID_OPTIONS.reduce((a, b) => (Math.abs(b - days) < Math.abs(a - days) ? b : a));

  return (
    <>
      <h1 className="mb-1 text-lg font-semibold">Editar orçamento #{q.number}</h1>
      {q.status !== "DRAFT" && (
        <p className="mb-4 text-sm text-muted-foreground">
          Ao salvar, volta para rascunho e o link já enviado deixa de permitir aprovação até você reenviar.
        </p>
      )}
      <QuoteForm
        services={services}
        customers={customers}
        userId={userId}
        initial={{
          quoteId: q.id,
          customerName: q.customerName,
          customerPhone: q.customerPhone,
          customerAddress: q.customerAddress ?? "",
          discountCents: q.discountCents,
          validDays,
          items: q.items.map((i) => ({
            serviceId: i.serviceId,
            description: i.description,
            unit: i.unit,
            quantity: Number(i.quantity),
            unitPriceCents: i.unitPriceCents,
          })),
        }}
      />
    </>
  );
}
