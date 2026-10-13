import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  approveQuoteByPublicId,
  createQuote,
  duplicateQuote,
  rejectQuoteByPublicId,
  renewQuote,
  completeMaintenanceReminder,
  setMaintenanceReminder,
  setQuotePaid,
  updateQuote,
} from "@/actions/quotes";
import { expireStaleQuotes } from "@/lib/quote-expiry";
import { loginAs, makeSystemService, makeUser, quoteInput, resetDb } from "../helpers/db";

beforeEach(resetDb);

async function newQuote(over: Record<string, unknown> = {}) {
  const res = await createQuote(quoteInput(over) as never);
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

async function send(id: string) {
  await db.quote.update({ where: { id }, data: { status: "SENT", sentAt: new Date() } });
}

describe("createQuote", () => {
  it("numera por técnico, sem colisão entre usuários", async () => {
    const a = await makeUser();
    const b = await makeUser();
    loginAs(a.id);
    const a1 = await newQuote();
    const a2 = await newQuote();
    loginAs(b.id);
    const b1 = await newQuote();
    expect([a1.number, a2.number, b1.number]).toEqual([1, 2, 1]);
  });

  it("numeração continua única com criações concorrentes", async () => {
    const u = await makeUser();
    loginAs(u.id);
    const all = await Promise.all(Array.from({ length: 8 }, () => newQuote()));
    expect(new Set(all.map((q) => q.number)).size).toBe(8);
  });

  it("calcula total em centavos e aplica desconto", async () => {
    loginAs((await makeUser()).id);
    const q = await newQuote({ discountCents: 5000 }); // 2 x 100,00 - 50,00
    expect(q.totalCents).toBe(15000);
  });

  it("rejeita desconto maior que o subtotal", async () => {
    loginAs((await makeUser()).id);
    const res = await createQuote(quoteInput({ discountCents: 999999 }) as never);
    expect(res.ok).toBe(false);
  });

  it("faz snapshot do catálogo e não muda quando o preço do serviço muda", async () => {
    loginAs((await makeUser()).id);
    const svc = await makeSystemService("Instalação", 45000);
    const q = await newQuote({ items: [{ serviceId: svc.id, quantity: 1 }] });
    await db.service.update({ where: { id: svc.id }, data: { priceCents: 99900, name: "Outro" } });
    const item = await db.quoteItem.findFirstOrThrow({ where: { quoteId: q.id } });
    expect(item).toMatchObject({ description: "Instalação", unitPriceCents: 45000, totalCents: 45000 });
  });

  it("rejeita serviço de outro técnico", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const own = await db.service.create({ data: { userId: a.id, name: "Do A", unit: "un", priceCents: 100 } });
    loginAs(b.id);
    const res = await createQuote(quoteInput({ items: [{ serviceId: own.id, quantity: 1 }] }) as never);
    expect(res.ok).toBe(false);
  });

  it("cria/atualiza o cliente pelo telefone", async () => {
    const u = await makeUser();
    loginAs(u.id);
    await newQuote({ customerName: "Maria" });
    await newQuote({ customerName: "Maria Silva", customerPhone: "11 99999 0000" });
    const customers = await db.customer.findMany({ where: { userId: u.id } });
    expect(customers).toHaveLength(1);
    expect(customers[0].name).toBe("Maria Silva");
  });
});

describe("aprovação e recusa públicas", () => {
  it("aprova só orçamento enviado e é idempotente", async () => {
    loginAs((await makeUser()).id);
    const q = await newQuote();
    expect((await approveQuoteByPublicId(q.publicId)).ok).toBe(false); // rascunho
    await send(q.id);
    expect((await approveQuoteByPublicId(q.publicId)).ok).toBe(true);
    expect((await approveQuoteByPublicId(q.publicId)).ok).toBe(true);
    expect((await db.quote.findUniqueOrThrow({ where: { id: q.id } })).status).toBe("APPROVED");
  });

  it("não aprova orçamento vencido", async () => {
    loginAs((await makeUser()).id);
    const q = await newQuote();
    await db.quote.update({
      where: { id: q.id },
      data: { status: "SENT", validUntil: new Date(Date.now() - 1000) },
    });
    expect((await approveQuoteByPublicId(q.publicId)).ok).toBe(false);
  });

  it("aprovar e recusar ao mesmo tempo: só um vence", async () => {
    loginAs((await makeUser()).id);
    const q = await newQuote();
    await send(q.id);
    const [a, r] = await Promise.all([approveQuoteByPublicId(q.publicId), rejectQuoteByPublicId(q.publicId, "caro")]);
    expect([a.ok, r.ok].filter(Boolean)).toHaveLength(1);
    const final = await db.quote.findUniqueOrThrow({ where: { id: q.id } });
    expect(["APPROVED", "REJECTED"]).toContain(final.status);
  });

  it("recusa guarda o motivo (limitado a 300) e não recusa aprovado", async () => {
    loginAs((await makeUser()).id);
    const q = await newQuote();
    await send(q.id);
    await rejectQuoteByPublicId(q.publicId, "x".repeat(500));
    const row = await db.quote.findUniqueOrThrow({ where: { id: q.id } });
    expect(row.status).toBe("REJECTED");
    expect(row.rejectReason).toHaveLength(300);

    const q2 = await newQuote({ customerPhone: "11988887777" });
    await send(q2.id);
    await approveQuoteByPublicId(q2.publicId);
    expect((await rejectQuoteByPublicId(q2.publicId)).ok).toBe(false);
  });

  it("rejeita publicId malformado", async () => {
    expect((await approveQuoteByPublicId("não-é-uuid")).ok).toBe(false);
  });
});

describe("edição, duplicação, renovação e pagamento", () => {
  it("editar volta para DRAFT e troca os itens", async () => {
    loginAs((await makeUser()).id);
    const q = await newQuote();
    await send(q.id);
    const res = await updateQuote(
      q.id,
      quoteInput({ items: [{ description: "Novo item", unit: "un", quantity: 1, unitPriceCents: 7000 }] }) as never,
    );
    expect(res.ok).toBe(true);
    const row = await db.quote.findUniqueOrThrow({ where: { id: q.id }, include: { items: true } });
    expect(row).toMatchObject({ status: "DRAFT", sentAt: null, totalCents: 7000 });
    expect(row.items).toHaveLength(1);
  });

  it("não edita orçamento aprovado", async () => {
    loginAs((await makeUser()).id);
    const q = await newQuote();
    await send(q.id);
    await approveQuoteByPublicId(q.publicId);
    expect((await updateQuote(q.id, quoteInput() as never)).ok).toBe(false);
  });

  it("isolamento: outro técnico não edita, duplica nem marca pago", async () => {
    const a = await makeUser();
    const b = await makeUser();
    loginAs(a.id);
    const q = await newQuote();
    await send(q.id);
    await approveQuoteByPublicId(q.publicId);
    loginAs(b.id);
    expect((await updateQuote(q.id, quoteInput() as never)).ok).toBe(false);
    expect((await duplicateQuote(q.id)).ok).toBe(false);
    expect((await setQuotePaid(q.id, true)).ok).toBe(false);
    expect((await renewQuote(q.id)).ok).toBe(false);
  });

  it("duplicar com desconto extra recalcula o total", async () => {
    loginAs((await makeUser()).id);
    const q = await newQuote(); // total 200,00
    const res = await duplicateQuote(q.id, 10);
    if (!res.ok) throw new Error(res.error);
    const copy = await db.quote.findUniqueOrThrow({ where: { id: res.data.id } });
    expect(copy).toMatchObject({ status: "DRAFT", discountCents: 2000, totalCents: 18000 });
    expect(copy.number).toBe(2);
  });

  it("expira SENT vencido e renova", async () => {
    const u = await makeUser();
    loginAs(u.id);
    const q = await newQuote();
    await db.quote.update({ where: { id: q.id }, data: { status: "SENT", validUntil: new Date(Date.now() - 1000) } });
    await expireStaleQuotes(u.id);
    expect((await db.quote.findUniqueOrThrow({ where: { id: q.id } })).status).toBe("EXPIRED");
    expect((await renewQuote(q.id)).ok).toBe(true);
    expect((await db.quote.findUniqueOrThrow({ where: { id: q.id } })).status).toBe("SENT");
  });

  it("só marca pago orçamento aprovado", async () => {
    loginAs((await makeUser()).id);
    const q = await newQuote();
    expect((await setQuotePaid(q.id, true)).ok).toBe(false);
    await send(q.id);
    await approveQuoteByPublicId(q.publicId);
    expect((await setQuotePaid(q.id, true)).ok).toBe(true);
    expect((await db.quote.findUniqueOrThrow({ where: { id: q.id } })).paidAt).not.toBeNull();
  });
});

describe("lembrete de manutenção", () => {
  async function approved() {
    const q = await newQuote();
    await send(q.id);
    await approveQuoteByPublicId(q.publicId);
    return q;
  }

  it("só em orçamento aprovado, com prazo válido", async () => {
    loginAs((await makeUser()).id);
    const draft = await newQuote();
    expect((await setMaintenanceReminder(draft.id, 6)).ok).toBe(false);
    const q = await approved();
    expect((await setMaintenanceReminder(q.id, 5)).ok).toBe(false);
    expect((await setMaintenanceReminder(q.id, 6)).ok).toBe(true);
    const row = await db.quote.findUniqueOrThrow({ where: { id: q.id } });
    const months = (row.reminderAt!.getTime() - Date.now()) / (30 * 86_400_000);
    expect(months).toBeGreaterThan(5.5);
    expect(months).toBeLessThan(6.5);
  });

  it("concluir e remover; isolamento entre técnicos", async () => {
    const a = await makeUser();
    const b = await makeUser();
    loginAs(a.id);
    const q = await approved();
    await setMaintenanceReminder(q.id, 3);
    loginAs(b.id);
    expect((await completeMaintenanceReminder(q.id)).ok).toBe(false);
    expect((await setMaintenanceReminder(q.id, null)).ok).toBe(false);
    loginAs(a.id);
    expect((await completeMaintenanceReminder(q.id)).ok).toBe(true);
    expect((await db.quote.findUniqueOrThrow({ where: { id: q.id } })).reminderDoneAt).not.toBeNull();
    expect((await setMaintenanceReminder(q.id, null)).ok).toBe(true);
    const row = await db.quote.findUniqueOrThrow({ where: { id: q.id } });
    expect(row).toMatchObject({ reminderAt: null, reminderDoneAt: null });
  });
});
