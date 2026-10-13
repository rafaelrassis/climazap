import { db } from "@/lib/db";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { buildPixPayload } from "@/lib/pix";
import { buildQuotePdf } from "@/lib/quote-pdf";

export const dynamic = "force-dynamic";

// PDF público do orçamento (mesmos dados da página pública: sem telefone nem endereço do cliente).
// Rascunho não tem PDF: ainda pode estar sendo editado.
export async function GET(_req: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(publicId)) return new Response("Not found", { status: 404 });

  const rl = await rateLimit(`pdf:${await getClientIp()}`, 30, 10 * 60);
  if (!rl.ok) return new Response("Muitas tentativas", { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } });

  const q = await db.quote.findUnique({
    where: { publicId },
    select: {
      number: true,
      customerName: true,
      title: true,
      notes: true,
      status: true,
      discountCents: true,
      totalCents: true,
      validUntil: true,
      createdAt: true,
      items: { orderBy: { position: "asc" }, select: { description: true, unit: true, quantity: true, unitPriceCents: true, totalCents: true } },
      user: { select: { name: true, companyName: true, logo: true, pixKey: true, pixCity: true } },
    },
  });
  if (!q || q.status === "DRAFT") return new Response("Not found", { status: 404 });

  const bytes = await buildQuotePdf({
    number: q.number,
    senderName: q.user.companyName ?? q.user.name,
    customerName: q.customerName,
    title: q.title,
    notes: q.notes,
    status: q.status,
    createdAt: q.createdAt,
    validUntil: q.validUntil,
    discountCents: q.discountCents,
    totalCents: q.totalCents,
    items: q.items.map((i) => ({ ...i, quantity: Number(i.quantity) })),
    logoPng: q.user.logo ? new Uint8Array(q.user.logo) : null,
    pix:
      q.status === "APPROVED" && q.user.pixKey && q.user.pixCity
        ? {
            key: q.user.pixKey,
            payload: buildPixPayload({
              key: q.user.pixKey,
              name: q.user.companyName ?? q.user.name,
              city: q.user.pixCity,
              amountCents: q.totalCents,
              txid: `FC${q.number}`,
            }),
          }
        : null,
  });

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="orcamento-${q.number}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
