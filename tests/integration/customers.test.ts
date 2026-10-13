import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { approveQuoteByPublicId, createQuote } from "@/actions/quotes";
import { listCustomers } from "@/actions/customers";
import { customerStats } from "@/lib/customers";
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
    expect(stats.get(maria.id)).toEqual({ quotes: 2, approvedCents: 20000, approvedCount: 1 });
    expect(stats.get(joao.id)).toEqual({ quotes: 1, approvedCents: 0, approvedCount: 0 });
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
