import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createQuote, markQuoteNudged, snoozeQuoteFollowUp } from "@/actions/quotes";
import { sendWeeklyDigest } from "@/lib/reminders";
import { loginAs, makeUser, quoteInput, resetDb } from "../helpers/db";

const sent: { to: string; subject: string; text: string }[] = [];
vi.mock("@/lib/email", async (orig) => ({
  ...(await orig<typeof import("@/lib/email")>()),
  sendEmail: async (m: { to: string; subject: string; text: string }) => {
    sent.push(m);
    return true;
  },
}));

const DAY = 24 * 60 * 60 * 1000;

beforeEach(async () => {
  await resetDb();
  sent.length = 0;
});

// Orçamento SENT, enviado há 3 dias; validUntil configurável
async function sentQuote(validInMs = 5 * DAY) {
  const res = await createQuote(quoteInput() as never);
  if (!res.ok) throw new Error(res.error);
  await db.quote.update({
    where: { id: res.data.id },
    data: { status: "SENT", sentAt: new Date(Date.now() - 3 * DAY), validUntil: new Date(Date.now() + validInMs) },
  });
  return res.data.id;
}

describe("cobrança de orçamentos", () => {
  it("markQuoteNudged grava lastNudgeAt só em SENT do próprio técnico", async () => {
    const a = await makeUser();
    const b = await makeUser();
    loginAs(a.id);
    const id = await sentQuote();

    loginAs(b.id);
    expect((await markQuoteNudged(id)).ok).toBe(false);
    expect((await db.quote.findUniqueOrThrow({ where: { id } })).lastNudgeAt).toBeNull();

    loginAs(a.id);
    expect((await markQuoteNudged(id)).ok).toBe(true);
    expect((await db.quote.findUniqueOrThrow({ where: { id } })).lastNudgeAt).not.toBeNull();

    await db.quote.update({ where: { id }, data: { status: "APPROVED" } });
    expect((await markQuoteNudged(id)).ok).toBe(false);
  });

  it("adiar põe lastNudgeAt no futuro e bloqueia quem vence em até 24h", async () => {
    const u = await makeUser();
    loginAs(u.id);
    const ok = await sentQuote(5 * DAY);
    const soon = await sentQuote(12 * 60 * 60 * 1000);

    expect((await snoozeQuoteFollowUp(ok)).ok).toBe(true);
    expect((await db.quote.findUniqueOrThrow({ where: { id: ok } })).lastNudgeAt!.getTime()).toBeGreaterThan(Date.now());

    expect((await snoozeQuoteFollowUp(soon)).ok).toBe(false);
    expect((await db.quote.findUniqueOrThrow({ where: { id: soon } })).lastNudgeAt).toBeNull();
  });

  it("resumo semanal ignora cobrados/adiados e volta a listar depois de 48h", async () => {
    const u = await makeUser("t@t.com");
    loginAs(u.id);
    const id = await sentQuote();

    await markQuoteNudged(id);
    expect(await sendWeeklyDigest()).toEqual({ users: 0, sent: 0 });

    await db.quote.update({ where: { id }, data: { lastNudgeAt: new Date(Date.now() - 3 * DAY) } });
    expect(await sendWeeklyDigest()).toEqual({ users: 1, sent: 1 });

    sent.length = 0;
    await snoozeQuoteFollowUp(id);
    expect(await sendWeeklyDigest()).toEqual({ users: 0, sent: 0 });
  });
});
