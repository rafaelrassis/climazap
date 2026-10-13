import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { approveQuoteByPublicId, createQuote } from "@/actions/quotes";
import { notifyQuoteResponse } from "@/lib/notify";
import { rateLimit } from "@/lib/rate-limit";
import { loginAs, makeUser, quoteInput, resetDb } from "../helpers/db";

// Carga e concorrência: limites folgados para não ficar instável em máquina lenta, mas pegam regressões grosseiras
beforeEach(resetDb);

describe("carga e concorrência", () => {
  it("rate limit: 300 chamadas sequenciais têm latência média baixa (cada login faz 2)", async () => {
    const t0 = performance.now();
    for (let i = 0; i < 300; i++) await rateLimit(`load:seq:${i % 10}`, 1000, 60);
    const avg = (performance.now() - t0) / 300;
    console.info(`[carga] rateLimit: ${avg.toFixed(1)} ms por chamada`);
    expect(avg).toBeLessThan(50);
  });

  it("rate limit: 100 chamadas simultâneas na mesma chave contam exatamente", async () => {
    const results = await Promise.all(Array.from({ length: 100 }, () => rateLimit("load:same", 40, 60)));
    expect(results.filter((r) => r.ok)).toHaveLength(40);
    expect((await db.rateLimit.findUniqueOrThrow({ where: { key: "load:same" } })).count).toBe(100);
  });

  it("30 orçamentos simultâneos do mesmo técnico: numeração única e sem buracos", async () => {
    const u = await makeUser();
    loginAs(u.id);
    const t0 = performance.now();
    const res = await Promise.all(Array.from({ length: 30 }, () => createQuote(quoteInput() as never)));
    console.info(`[carga] 30 createQuote simultâneos: ${Math.round(performance.now() - t0)} ms`);
    expect(res.every((r) => r.ok)).toBe(true);
    const numbers = (await db.quote.findMany({ where: { userId: u.id }, select: { number: true } })).map((q) => q.number).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).quoteSeq).toBe(30);
  });

  it("15 aprovações simultâneas do mesmo link (abaixo do limite público de 20): uma só transição e um só aviso", async () => {
    const u = await makeUser();
    loginAs(u.id);
    const q = await createQuote(quoteInput() as never);
    if (!q.ok) throw new Error(q.error);
    await db.quote.update({ where: { id: q.data.id }, data: { status: "SENT", sentAt: new Date() } });
    vi_clearNotify();

    const res = await Promise.all(Array.from({ length: 15 }, () => approveQuoteByPublicId(q.data.publicId)));
    expect(res.every((r) => r.ok)).toBe(true); // idempotente para quem chega depois
    expect((await db.quote.findUniqueOrThrow({ where: { id: q.data.id } })).status).toBe("APPROVED");
    expect(vi_notifyCalls()).toBe(1); // só quem de fato aprovou avisa
  });

  it("acima de 20 aprovações por IP em 10 min, o excedente é barrado", async () => {
    const u = await makeUser();
    loginAs(u.id);
    const q = await createQuote(quoteInput() as never);
    if (!q.ok) throw new Error(q.error);
    await db.quote.update({ where: { id: q.data.id }, data: { status: "SENT", sentAt: new Date() } });
    const res = await Promise.all(Array.from({ length: 30 }, () => approveQuoteByPublicId(q.data.publicId)));
    expect(res.filter((r) => r.ok)).toHaveLength(20);
    expect(res.filter((r) => !r.ok && r.error.startsWith("Muitas tentativas"))).toHaveLength(10);
  });

  it("50 técnicos criando orçamento ao mesmo tempo não se atrapalham", async () => {
    const users = await Promise.all(Array.from({ length: 50 }, () => makeUser()));
    // loginAs é global no teste: cria direto no banco pela mesma transação de numeração
    await Promise.all(
      users.map((u) =>
        db.$transaction(async (tx) => {
          const { quoteSeq } = await tx.user.update({ where: { id: u.id }, data: { quoteSeq: { increment: 1 } }, select: { quoteSeq: true } });
          await tx.quote.create({ data: { userId: u.id, number: quoteSeq, customerName: "Cliente", customerPhone: "11999990000", totalCents: 100 } });
        }),
      ),
    );
    const firsts = await db.quote.findMany({ select: { number: true } });
    expect(firsts).toHaveLength(50);
    expect(firsts.every((q) => q.number === 1)).toBe(true);
  });
});

import { vi } from "vitest";
function vi_clearNotify() {
  vi.mocked(notifyQuoteResponse).mockClear();
}
function vi_notifyCalls() {
  return vi.mocked(notifyQuoteResponse).mock.calls.length;
}
