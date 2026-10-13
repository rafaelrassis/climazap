"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { calcLineCents, formatBRL } from "@/lib/money";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { createQuoteSchema, type CreateQuoteInput } from "@/lib/validations/quote";
import type { ActionResult } from "@/types/action";

export async function createQuote(
  input: CreateQuoteInput,
): Promise<ActionResult<{ id: string; publicId: string; number: number; totalCents: number }>> {
  const userId = await requireUserId();
  const parsed = createQuoteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Dados inválidos", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  const serviceIds = Array.from(new Set(data.items.map((i) => i.serviceId).filter((v): v is string => !!v)));
  const services = serviceIds.length
    ? await db.service.findMany({
        where: { id: { in: serviceIds }, isActive: true, OR: [{ userId: null }, { userId }] },
      })
    : [];
  const serviceMap = new Map(services.map((s) => [s.id, s]));

  if (serviceIds.some((id) => !serviceMap.has(id))) {
    return { ok: false, error: "Serviço não encontrado" };
  }

  // Snapshot: copia descrição/unidade/preço do catálogo no momento da criação
  const items = data.items.map((item, position) => {
    const svc = item.serviceId ? serviceMap.get(item.serviceId)! : null;
    const quantity = Math.round(item.quantity * 100) / 100;
    const unitPriceCents = item.unitPriceCents ?? svc!.priceCents;
    return {
      serviceId: svc?.id ?? null,
      description: item.description ?? svc!.name,
      unit: item.unit ?? svc?.unit ?? "un",
      quantity,
      unitPriceCents,
      totalCents: calcLineCents(quantity, unitPriceCents),
      position,
    };
  });

  const subtotal = items.reduce((acc, i) => acc + i.totalCents, 0);
  if (data.discountCents > subtotal) {
    return { ok: false, error: "Desconto maior que o subtotal" };
  }
  const totalCents = subtotal - data.discountCents;
  const validUntil = new Date(Date.now() + data.validDays * 24 * 60 * 60 * 1000);

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
