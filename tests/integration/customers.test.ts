import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { approveQuoteByPublicId, createQuote } from "@/actions/quotes";
import { deleteCustomer, listCustomers, updateCustomer } from "@/actions/customers";
import { customerStats, isDormant } from "@/lib/customers";
import { loginAs, makeUser, quoteInput, resetDb } from "../helpers/db";

beforeEach(resetDb);

async function quote(phone: string, name: string, approve = false) {
  const res = await createQuote(quoteInput({ customerName: name, customerPhone: phone }) as never); // total R$ 200,00
  if (!res.ok) throw new Error(res.error);
  if (approve) {
    await db.quote.update({ where: { id: res.data.id }, data: { status: "SENT", sentAt: new Date() } });
    await approveQuoteByPublicId(res.data.publicId);
  }
  return res.data;
}

describe("clientes", () => {
  it("estatísticas por cliente: total de orçamentos e valor aprovado", async () => {
    const u = await makeUser();
    loginAs(u.id);
    await quote("11999990001", "Maria", true);
    await quote("11999990001", "Maria"); // rascunho, mesmo cliente
    await quote("11999990002", "João");

    const customers = await db.customer.findMany({ where: { userId: u.id } });
    const stats = await customerStats(u.id);
    const maria = customers.find((c) => c.name === "Maria")!;
    const joao = customers.find((c) => c.name === "João")!;
    expect(stats.get(maria.id)).toMatchObject({ quotes: 2, approvedCents: 20000, approvedCount: 1 });
    expect(stats.get(joao.id)).toMatchObject({ quotes: 1, approvedCents: 0, approvedCount: 0 });
  });

  it("estatísticas e lista não vazam entre técnicos", async () => {
    const a = await makeUser();
    const b = await makeUser();
    loginAs(a.id);
    await quote("11999990001", "Cliente do A", true);
    loginAs(b.id);
    expect(await listCustomers()).toHaveLength(0);
    expect((await customerStats(b.id)).size).toBe(0);
  });
});

describe("editar, excluir e dormentes", () => {
  it("edita nome e endereço só do próprio cliente; telefone não muda", async () => {
    const a = await makeUser();
    const b = await makeUser();
    loginAs(a.id);
    await quote("11999990001", "Maria");
    const c = await db.customer.findFirstOrThrow({ where: { userId: a.id } });

    expect((await updateCustomer({ id: c.id, name: "Maria Silva", address: "Rua Nova, 5" })).ok).toBe(true);
    const row = await db.customer.findUniqueOrThrow({ where: { id: c.id } });
    expect(row).toMatchObject({ name: "Maria Silva", address: "Rua Nova, 5", phone: "11999990001" });
    expect((await updateCustomer({ id: c.id, name: "X" })).ok).toBe(false); // nome curto

    loginAs(b.id);
    expect((await updateCustomer({ id: c.id, name: "Invasor" })).ok).toBe(false);
    expect((await deleteCustomer(c.id)).ok).toBe(false);
    expect((await db.customer.findUniqueOrThrow({ where: { id: c.id } })).name).toBe("Maria Silva");
  });

  it("excluir mantém os orçamentos (snapshot) e desfaz o vínculo", async () => {
    const u = await makeUser();
    loginAs(u.id);
    const q = await quote("11999990001", "Maria", true);
    const c = await db.customer.findFirstOrThrow({ where: { userId: u.id } });
    expect((await deleteCustomer(c.id)).ok).toBe(true);
    const kept = await db.quote.findUniqueOrThrow({ where: { id: q.id } });
    expect(kept).toMatchObject({ customerId: null, customerName: "Maria", status: "APPROVED" });
    expect(await listCustomers()).toHaveLength(0);
  });

  it("dormente: sem orçamento há mais de 180 dias", () => {
    const now = new Date("2026-10-13T12:00:00Z");
    const old = new Date("2026-03-01T00:00:00Z");
    const recent = new Date("2026-09-01T00:00:00Z");
    expect(isDormant({ quotes: 1, approvedCents: 0, approvedCount: 0, lastQuoteAt: old }, recent, now)).toBe(true);
    expect(isDormant({ quotes: 1, approvedCents: 0, approvedCount: 0, lastQuoteAt: recent }, old, now)).toBe(false);
    expect(isDormant(undefined, old, now)).toBe(true); // sem orçamentos e cadastrado há muito tempo
    expect(isDormant(undefined, recent, now)).toBe(false);
  });
});
