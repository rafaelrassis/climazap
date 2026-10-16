import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { GET } from "@/app/api/cron/lembretes/route";
import { GET as expirar } from "@/app/api/cron/expirar/route";
import { loginAs, makeUser, quoteInput, resetDb } from "../helpers/db";
import { approveQuoteByPublicId, createQuote, setMaintenanceReminder } from "@/actions/quotes";

const sent: { to: string; subject: string }[] = [];
vi.mock("@/lib/email", async (orig) => ({
  ...(await orig<typeof import("@/lib/email")>()),
  sendEmail: async (m: { to: string; subject: string }) => {
    sent.push(m);
    return true;
  },
}));

const call = (auth?: string) =>
  GET(new Request("http://localhost/api/cron/lembretes", { headers: auth === undefined ? {} : { authorization: auth } }));

beforeEach(async () => {
  await resetDb();
  sent.length = 0;
  process.env.CRON_SECRET = "segredo-do-cron";
});

describe("rota do cron semanal", () => {
  it("sem segredo configurado, recusa tudo (inclusive 'Bearer undefined')", async () => {
    delete process.env.CRON_SECRET;
    expect((await call("Bearer undefined")).status).toBe(401);
    expect((await call("Bearer ")).status).toBe(401);
    expect((await call()).status).toBe(401);
  });

  it("recusa cabeçalho ausente, errado, de tamanho diferente e sem 'Bearer'", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer errado")).status).toBe(401);
    expect((await call("Bearer segredo-do-cron-")).status).toBe(401);
    expect((await call("segredo-do-cron")).status).toBe(401);
    expect((await call("bearer segredo-do-cron")).status).toBe(401);
  });

  it("com o segredo certo roda o resumo e envia e-mail a quem tem lembrete vencido", async () => {
    const u = await makeUser("tec@t.com");
    loginAs(u.id);
    const q = await createQuote(quoteInput({ customerName: "Cliente do Cron" }) as never);
    if (!q.ok) throw new Error(q.error);
    await db.quote.update({ where: { id: q.data.id }, data: { status: "SENT", sentAt: new Date() } });
    await approveQuoteByPublicId(q.data.publicId);
    await setMaintenanceReminder(q.data.id, 3);
    await db.quote.update({ where: { id: q.data.id }, data: { reminderAt: new Date(Date.now() - 1000) } });

    const res = await call("Bearer segredo-do-cron");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, users: 1, sent: 1 });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("tec@t.com");
  });

  it("sem nada pendente responde 200 e não envia e-mail", async () => {
    await makeUser();
    const res = await call("Bearer segredo-do-cron");
    expect(await res.json()).toEqual({ ok: true, users: 0, sent: 0 });
    expect(sent).toHaveLength(0);
  });
});

describe("rota do cron diário de expiração", () => {
  const callExpirar = (auth?: string) =>
    expirar(new Request("http://localhost/api/cron/expirar", { headers: auth === undefined ? {} : { authorization: auth } }));

  it("recusa sem segredo ou com segredo errado", async () => {
    expect((await callExpirar()).status).toBe(401);
    expect((await callExpirar("Bearer errado")).status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await callExpirar("Bearer undefined")).status).toBe(401);
  });

  it("expira SENT vencidos de todos os técnicos e preserva o resto", async () => {
    const mk = async (status: "SENT" | "APPROVED", validUntil: Date | null) => {
      const u = await makeUser();
      loginAs(u.id);
      const q = await createQuote(quoteInput() as never);
      if (!q.ok) throw new Error(q.error);
      await db.quote.update({ where: { id: q.data.id }, data: { status, sentAt: new Date(), validUntil } });
      return q.data.id;
    };
    const past = new Date(Date.now() - 1000);
    const future = new Date(Date.now() + 86400000);
    const a = await mk("SENT", past);
    const b = await mk("SENT", past);
    const valid = await mk("SENT", future);
    const noDeadline = await mk("SENT", null);
    const approved = await mk("APPROVED", past);

    const res = await callExpirar("Bearer segredo-do-cron");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, expired: 2 });
    const status = async (id: string) => (await db.quote.findUniqueOrThrow({ where: { id } })).status;
    expect([await status(a), await status(b)]).toEqual(["EXPIRED", "EXPIRED"]);
    expect(await status(valid)).toBe("SENT");
    expect(await status(noDeadline)).toBe("SENT");
    expect(await status(approved)).toBe("APPROVED");
  });
});
