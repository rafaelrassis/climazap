import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { approveQuoteByPublicId, completeMaintenanceReminder, createQuote, setMaintenanceReminder } from "@/actions/quotes";
import { sendWeeklyDigest } from "@/lib/reminders";
import { loginAs, makeUser, quoteInput, resetDb } from "../helpers/db";

const sent: { to: string; subject: string; html: string; headers?: Record<string, string> }[] = [];
vi.mock("@/lib/email", async (orig) => ({
  ...(await orig<typeof import("@/lib/email")>()),
  sendEmail: async (m: { to: string; subject: string; html: string; headers?: Record<string, string> }) => {
    sent.push(m);
    return true;
  },
}));

beforeEach(async () => {
  await resetDb();
  sent.length = 0;
});

async function approvedWithReminder(name: string, months: 3 | 6 | 12 = 3) {
  const res = await createQuote(quoteInput({ customerName: name, customerPhone: `1199999${Math.floor(1000 + Math.random() * 8999)}` }) as never);
  if (!res.ok) throw new Error(res.error);
  await db.quote.update({ where: { id: res.data.id }, data: { status: "SENT", sentAt: new Date() } });
  await approveQuoteByPublicId(res.data.publicId);
  await setMaintenanceReminder(res.data.id, months);
  return res.data;
}

const pastDue = (id: string) => db.quote.update({ where: { id }, data: { reminderAt: new Date(Date.now() - 1000) } });

describe("resumo semanal", () => {
  it("um e-mail por técnico, só com lembretes vencidos e pendentes", async () => {
    const a = await makeUser("a@t.com");
    const b = await makeUser("b@t.com");
    loginAs(a.id);
    const due1 = await approvedWithReminder("Maria <b>");
    const due2 = await approvedWithReminder("João");
    const future = await approvedWithReminder("Futuro", 12);
    const done = await approvedWithReminder("Concluído");
    await pastDue(due1.id);
    await pastDue(due2.id);
    await pastDue(done.id);
    await completeMaintenanceReminder(done.id);
    loginAs(b.id);
    const bDue = await approvedWithReminder("Cliente do B");
    await pastDue(bDue.id);

    const result = await sendWeeklyDigest();
    expect(result).toEqual({ users: 2, sent: 2 });

    const mailA = sent.find((m) => m.to === "a@t.com")!;
    expect(mailA.subject).toBe("Resumo da semana: 2 clientes para chamar");
    expect(mailA.html).toContain("João");
    expect(mailA.html).toContain("Maria &lt;b&gt;"); // HTML escapado
    expect(mailA.html).not.toContain("Futuro");
    expect(mailA.html).not.toContain("Concluído");
    expect(mailA.html).not.toContain("Cliente do B");
    expect(future.id).toBeTruthy();

    const mailB = sent.find((m) => m.to === "b@t.com")!;
    expect(mailB.subject).toBe("Resumo da semana: 1 cliente para chamar");
  });

  it("sem lembretes vencidos não envia nada", async () => {
    loginAs((await makeUser()).id);
    await approvedWithReminder("Futuro", 6);
    expect(await sendWeeklyDigest()).toEqual({ users: 0, sent: 0 });
    expect(sent).toHaveLength(0);
  });
});

describe("resumo semanal: orçamentos sem resposta e descadastro", () => {
  async function sentQuote(name: string, sentDaysAgo: number, validDays = 7) {
    const res = await createQuote(quoteInput({ customerName: name, customerPhone: `1198888${Math.floor(1000 + Math.random() * 8999)}` }) as never);
    if (!res.ok) throw new Error(res.error);
    await db.quote.update({
      where: { id: res.data.id },
      data: {
        status: "SENT",
        sentAt: new Date(Date.now() - sentDaysAgo * 86_400_000),
        validUntil: new Date(Date.now() + validDays * 86_400_000),
      },
    });
  }

  it("inclui só enviados há 2+ dias e ainda válidos", async () => {
    loginAs((await makeUser("c@t.com")).id);
    await sentQuote("Parado Há Três Dias", 3);
    await sentQuote("Enviado Hoje", 0);
    await sentQuote("Vencido", 5, -1);
    const result = await sendWeeklyDigest();
    expect(result).toEqual({ users: 1, sent: 1 });
    const mail = sent[0];
    expect(mail.html).toContain("Parado Há Três Dias");
    expect(mail.html).not.toContain("Enviado Hoje");
    expect(mail.html).not.toContain("Vencido");
    expect(mail.html).toContain("Orçamentos sem resposta");
    expect(mail.html).toContain("/descadastro?u=");
    expect(mail.headers?.["List-Unsubscribe"]).toMatch(/^<http:\/\/localhost:3000\/api\/descadastro\?u=.+&t=[0-9a-f]{64}>$/);
    expect(mail.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });

  it("não envia para quem desativou o resumo", async () => {
    const u = await makeUser("d@t.com");
    loginAs(u.id);
    await sentQuote("Parado", 4);
    await db.user.update({ where: { id: u.id }, data: { emailDigest: false } });
    expect(await sendWeeklyDigest()).toEqual({ users: 0, sent: 0 });
    expect(sent).toHaveLength(0);
  });
});
