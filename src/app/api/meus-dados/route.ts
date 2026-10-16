import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

// Portabilidade (LGPD art. 18): todos os dados do técnico logado em JSON. Nunca inclui hash de senha nem dados de outros técnicos.
export async function GET() {
  const userId = await getUserId();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      companyName: true,
      waTemplate: true,
      nudgeTemplate: true,
      emailDigest: true,
      termsAcceptedAt: true,
      createdAt: true,
      logoType: true,
      nudges: { select: { kind: true, createdAt: true } },
      customers: { select: { name: true, phone: true, address: true, createdAt: true } },
      services: { select: { name: true, description: true, unit: true, priceCents: true, isActive: true, createdAt: true } },
      quotes: {
        orderBy: { number: "asc" },
        select: {
          number: true,
          status: true,
          customerName: true,
          customerPhone: true,
          customerAddress: true,
          title: true,
          notes: true,
          discountCents: true,
          totalCents: true,
          validUntil: true,
          sentAt: true,
          respondedAt: true,
          rejectReason: true,
          paidAt: true,
          reminderAt: true,
          createdAt: true,
          _count: { select: { photos: true } },
          items: { orderBy: { position: "asc" }, select: { description: true, unit: true, quantity: true, unitPriceCents: true, totalCents: true } },
        },
      },
    },
  });
  if (!user) return new Response("Not found", { status: 404 });

  const body = JSON.stringify({ exportedAt: new Date().toISOString(), ...user }, null, 2);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="fechouclima-meus-dados.json"`,
      "Cache-Control": "no-store",
    },
  });
}
