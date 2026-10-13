"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { LIMITS, getClientIp, rateLimit } from "@/lib/rate-limit";
import { requireUserId } from "@/lib/session";
import { calcLineCents, formatBRL } from "@/lib/money";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { createQuoteSchema, type CreateQuoteInput } from "@/lib/validations/quote";
import type { ActionResult } from "@/types/action";

type Prepared = {
  items: {
    serviceId: string | null;
    description: string;
    unit: string;
    quantity: number;
    unitPriceCents: number;
    totalCents: number;
    position: number;
  }[];
  totalCents: number;
  validUntil: Date;
};

// Valida e monta o snapshot dos itens. lenient: serviço removido do catálogo vira item avulso (edição).
async function prepareQuote(
  userId: string,
  data: z.output<typeof createQuoteSchema>,
  lenient: boolean,
): Promise<{ ok: true; prepared: Prepared } | { ok: false; error: string }> {
  const serviceIds = Array.from(new Set(data.items.map((i) => i.serviceId).filter((v): v is string => !!v)));
  const services = serviceIds.length
    ? await db.service.findMany({
        where: { id: { in: serviceIds }, isActive: true, OR: [{ userId: null }, { userId }] },
      })
    : [];
  const serviceMap = new Map(services.map((s) => [s.id, s]));

  if (!lenient && serviceIds.some((id) => !serviceMap.has(id))) {
    return { ok: false, error: "Serviço não encontrado" };
  }

  // Snapshot: copia descrição/unidade/preço do catálogo no momento da criação
  const items: Prepared["items"] = [];
  for (let position = 0; position < data.items.length; position++) {
    const item = data.items[position];
    const svc = item.serviceId ? (serviceMap.get(item.serviceId) ?? null) : null;
    const description = item.description ?? svc?.name;
    const unitPriceCents = item.unitPriceCents ?? svc?.priceCents;
    if (!description || unitPriceCents === undefined) return { ok: false, error: "Item inválido" };
    const quantity = Math.round(item.quantity * 100) / 100;
    items.push({
      serviceId: svc?.id ?? null,
      description,
      unit: item.unit ?? svc?.unit ?? "un",
      quantity,
      unitPriceCents,
      totalCents: calcLineCents(quantity, unitPriceCents),
      position,
    });
  }

  const subtotal = items.reduce((acc, i) => acc + i.totalCents, 0);
  if (data.discountCents > subtotal) return { ok: false, error: "Desconto maior que o subtotal" };

  return {
    ok: true,
    prepared: {
      items,
      totalCents: subtotal - data.discountCents,
      validUntil: new Date(Date.now() + data.validDays * 24 * 60 * 60 * 1000),
    },
  };
}

export async function createQuote(
  input: CreateQuoteInput,
): Promise<ActionResult<{ id: string; publicId: string; number: number; totalCents: number }>> {
  const userId = await requireUserId();
  const parsed = createQuoteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Dados inválidos", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  const prep = await prepareQuote(userId, data, false);
  if (!prep.ok) return prep;
  const { items, totalCents, validUntil } = prep.prepared;

  const quote = await db.$transaction(async (tx) => {
    const { quoteSeq } = await tx.user.update({
      where: { id: userId },
      data: { quoteSeq: { increment: 1 } },
      select: { quoteSeq: true },
    });
    return tx.quote.create({
      data: {
        userId,
        number: quoteSeq,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerAddress: data.customerAddress,
        title: data.title,
        notes: data.notes,
        discountCents: data.discountCents,
        totalCents,
        validUntil,
        items: { create: items },
      },
      select: { id: true, publicId: true, number: true, totalCents: true },
    });
  });

  revalidatePath("/orcamentos");
  return { ok: true, data: quote };
}

// Edita um orçamento não aprovado. Volta para DRAFT: o link antigo deixa de permitir aprovar a versão velha.
export async function updateQuote(
  quoteId: string,
  input: CreateQuoteInput,
): Promise<ActionResult<{ id: string; number: number }>> {
  const userId = await requireUserId();
  const parsed = createQuoteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Dados inválidos", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  const prep = await prepareQuote(userId, data, true);
  if (!prep.ok) return prep;
  const { items, totalCents, validUntil } = prep.prepared;

  const updated = await db.$transaction(async (tx) => {
    // updateMany condicional: se o cliente aprovou no meio da edição, count = 0
    const { count } = await tx.quote.updateMany({
      where: { id: quoteId, userId, status: { not: "APPROVED" } },
      data: {
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerAddress: data.customerAddress ?? null,
        title: data.title ?? null,
        notes: data.notes ?? null,
        discountCents: data.discountCents,
        totalCents,
        validUntil,
        status: "DRAFT",
        sentAt: null,
        respondedAt: null,
        rejectReason: null,
      },
    });
    if (count === 0) return null;
    await tx.quoteItem.deleteMany({ where: { quoteId } });
    await tx.quoteItem.createMany({ data: items.map((i) => ({ ...i, quoteId })) });
    return tx.quote.findUniqueOrThrow({ where: { id: quoteId }, select: { publicId: true, number: true } });
  });

  if (!updated) return { ok: false, error: "Orçamento não encontrado ou já aprovado" };

  revalidatePath("/orcamentos");
  revalidatePath(`/orcamentos/${quoteId}`);
  revalidatePath(`/o/${updated.publicId}`);
  return { ok: true, data: { id: quoteId, number: updated.number } };
}

// Gera o link wa.me e marca como SENT (se ainda rascunho)
export async function sendQuoteViaWhatsApp(quoteId: string): Promise<ActionResult<{ url: string }>> {
  const userId = await requireUserId();

  const quote = await db.quote.findFirst({
    where: { id: quoteId, userId },
    include: { user: { select: { name: true, companyName: true } } },
  });
  if (!quote) return { ok: false, error: "Orçamento não encontrado" };

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl) return { ok: false, error: "NEXT_PUBLIC_APP_URL não configurada" };

  const publicUrl = `${baseUrl.replace(/\/$/, "")}/o/${quote.publicId}`;
  const sender = quote.user.companyName ?? quote.user.name;
  const message =
    `Olá, ${quote.customerName}! Segue o orçamento #${quote.number} de ${sender} ` +
    `no valor de ${formatBRL(quote.totalCents)}.\n\nVeja os detalhes e aprove aqui: ${publicUrl}`;

  if (quote.status === "DRAFT") {
    await db.quote.update({
      where: { id: quote.id },
      data: { status: "SENT", sentAt: new Date() },
    });
    revalidatePath("/orcamentos");
    revalidatePath(`/orcamentos/${quote.id}`);
    revalidatePath(`/o/${quote.publicId}`);
  }

  return { ok: true, data: { url: buildWhatsAppUrl(quote.customerPhone, message) } };
}

// Pública (sem auth): cliente aprova pelo link
export async function approveQuoteByPublicId(publicId: string): Promise<ActionResult> {
  const rl = await rateLimit(`public:${await getClientIp()}`, LIMITS.publicAction.limit, LIMITS.publicAction.windowSec);
  if (!rl.ok) return { ok: false, error: "Muitas tentativas. Tente novamente em alguns minutos." };
  if (!/^[0-9a-f-]{36}$/i.test(publicId)) return { ok: false, error: "Link inválido" };

  const now = new Date();
  // updateMany atômico: evita dupla aprovação e aprovação após expirar
  const { count } = await db.quote.updateMany({
    where: {
      publicId,
      status: "SENT",
      OR: [{ validUntil: null }, { validUntil: { gt: now } }],
    },
    data: { status: "APPROVED", respondedAt: now },
  });

  if (count === 0) {
    const q = await db.quote.findUnique({ where: { publicId }, select: { status: true } });
    if (!q) return { ok: false, error: "Orçamento não encontrado" };
    if (q.status === "APPROVED") return { ok: true, data: undefined };
    return { ok: false, error: "Este orçamento não pode mais ser aprovado" };
  }

  revalidatePath(`/o/${publicId}`);
  revalidatePath("/orcamentos");
  return { ok: true, data: undefined };
}

// Copia o orçamento como novo rascunho (snapshot dos itens, sem recalcular pelo catálogo)
export async function duplicateQuote(
  quoteId: string,
  extraDiscountPercent = 0,
): Promise<ActionResult<{ id: string }>> {
  const userId = await requireUserId();

  const src = await db.quote.findFirst({
    where: { id: quoteId, userId },
    include: { items: { orderBy: { position: "asc" } } },
  });
  if (!src) return { ok: false, error: "Orçamento não encontrado" };

  const pct = Math.min(Math.max(extraDiscountPercent, 0), 50);
  const subtotal = src.items.reduce((acc, i) => acc + i.totalCents, 0);
  const discountCents = Math.min(src.discountCents + Math.round((subtotal * pct) / 100), subtotal);

  const copy = await db.$transaction(async (tx) => {
    const { quoteSeq } = await tx.user.update({
      where: { id: userId },
      data: { quoteSeq: { increment: 1 } },
      select: { quoteSeq: true },
    });
    return tx.quote.create({
      data: {
        userId,
        number: quoteSeq,
        customerName: src.customerName,
        customerPhone: src.customerPhone,
        customerAddress: src.customerAddress,
        title: src.title,
        notes: src.notes,
        discountCents,
        totalCents: subtotal - discountCents,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        items: {
          create: src.items.map((i) => ({
            serviceId: i.serviceId,
            description: i.description,
            unit: i.unit,
            quantity: i.quantity,
            unitPriceCents: i.unitPriceCents,
            totalCents: i.totalCents,
            position: i.position,
          })),
        },
      },
      select: { id: true },
    });
  });

  revalidatePath("/orcamentos");
  return { ok: true, data: copy };
}

// Pública (sem auth): cliente recusa pelo link, com motivo opcional
export async function rejectQuoteByPublicId(publicId: string, reason?: string): Promise<ActionResult> {
  const rl = await rateLimit(`public:${await getClientIp()}`, LIMITS.publicAction.limit, LIMITS.publicAction.windowSec);
  if (!rl.ok) return { ok: false, error: "Muitas tentativas. Tente novamente em alguns minutos." };
  if (!/^[0-9a-f-]{36}$/i.test(publicId)) return { ok: false, error: "Link inválido" };

  const rejectReason = reason?.trim().slice(0, 300) || null;
  const { count } = await db.quote.updateMany({
    where: { publicId, status: "SENT" },
    data: { status: "REJECTED", respondedAt: new Date(), rejectReason },
  });

  if (count === 0) {
    const q = await db.quote.findUnique({ where: { publicId }, select: { status: true } });
    if (!q) return { ok: false, error: "Orçamento não encontrado" };
    if (q.status === "REJECTED") return { ok: true, data: undefined };
    return { ok: false, error: "Este orçamento não pode mais ser recusado" };
  }

  revalidatePath(`/o/${publicId}`);
  revalidatePath("/orcamentos");
  return { ok: true, data: undefined };
}

// Renova a validade de um orçamento expirado e o devolve para "Enviado"
export async function renewQuote(quoteId: string, days = 7): Promise<ActionResult> {
  const userId = await requireUserId();
  const { count } = await db.quote.updateMany({
    where: { id: quoteId, userId, status: { in: ["EXPIRED", "SENT"] } },
    data: { status: "SENT", validUntil: new Date(Date.now() + days * 24 * 60 * 60 * 1000) },
  });
  if (count === 0) return { ok: false, error: "Orçamento não pode ser renovado" };

  const q = await db.quote.findFirst({ where: { id: quoteId, userId }, select: { publicId: true } });
  if (q) revalidatePath(`/o/${q.publicId}`);
  revalidatePath(`/orcamentos/${quoteId}`);
  revalidatePath("/orcamentos");
  return { ok: true, data: undefined };
}
