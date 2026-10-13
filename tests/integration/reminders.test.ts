import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { approveQuoteByPublicId, completeMaintenanceReminder, createQuote, setMaintenanceReminder } from "@/actions/quotes";
import { sendDueReminderEmails } from "@/lib/reminders";
import { loginAs, makeUser, quoteInput, resetDb } from "../helpers/db";

const sent: { to: string; subject: string; html: string }[] = [];
vi.mock("@/lib/email", async (orig) => ({
  ...(await orig<typeof import("@/lib/email")>()),
  sendEmail: async (m: { to: string; subject: string; html: string }) => {
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

describe("e-mail semanal de lembretes", () => {
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

    const result = await sendDueReminderEmails();
    expect(result).toEqual({ users: 2, sent: 2 });

    const mailA = sent.find((m) => m.to === "a@t.com")!;
    expect(mailA.subject).toBe("2 clientes para chamar para manutenção");
    expect(mailA.html).toContain("João");
    expect(mailA.html).toContain("Maria &lt;b&gt;"); // HTML escapado
    expect(mailA.html).not.toContain("Futuro");
    expect(mailA.html).not.toContain("Concluído");
    expect(mailA.html).not.toContain("Cliente do B");
    expect(future.id).toBeTruthy();

    const mailB = sent.find((m) => m.to === "b@t.com")!;
    expect(mailB.subject).toBe("1 cliente para chamar para manutenção");
  });

  it("sem lembretes vencidos não envia nada", async () => {
    loginAs((await makeUser()).id);
    await approvedWithReminder("Futuro", 6);
    expect(await sendDueReminderEmails()).toEqual({ users: 0, sent: 0 });
    expect(sent).toHaveLength(0);
  });
});
