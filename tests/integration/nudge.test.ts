import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createQuote, markQuoteNudged, snoozeQuoteFollowUp } from "@/actions/quotes";
import { followUpWhere, staleWhere } from "@/lib/followup-queries";
import { getNudgeFunnel } from "@/lib/nudge-funnel";
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
    expect(await db.quoteNudge.findMany({ where: { quoteId: id } })).toMatchObject([{ kind: "NUDGE", userId: a.id }]);

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

    expect(await db.quoteNudge.findMany({ where: { quoteId: ok } })).toMatchObject([{ kind: "SNOOZE" }]);

    expect((await snoozeQuoteFollowUp(soon)).ok).toBe(false);
    expect((await db.quote.findUniqueOrThrow({ where: { id: soon } })).lastNudgeAt).toBeNull();
    expect(await db.quoteNudge.count({ where: { quoteId: soon } })).toBe(0);
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

describe("filtros compartilhados (followup-queries)", () => {
  it("painel: sem resposta ou vencendo, respeitando cobrança e adiamento", async () => {
    const u = await makeUser();
    loginAs(u.id);
    const stale = await sentQuote(5 * DAY); // enviado há 3 dias
    const soon = await sentQuote(12 * 60 * 60 * 1000); // vence em 12h
    const fresh = await sentQuote(5 * DAY);
    await db.quote.update({ where: { id: fresh }, data: { sentAt: new Date() } }); // enviado agora

    const ids = async () =>
      (await db.quote.findMany({ where: { userId: u.id, ...followUpWhere(new Date()) }, select: { id: true } })).map((q) => q.id).sort();

    expect(await ids()).toEqual([stale, soon].sort());

    await markQuoteNudged(stale);
    await markQuoteNudged(soon);
    expect(await ids()).toEqual([]); // cobrados agora somem

    await db.quote.updateMany({ where: { id: soon }, data: { lastNudgeAt: new Date(Date.now() - 2 * 60 * 60 * 1000) } });
    expect(await ids()).toEqual([]); // vence em 12h, cobrado há 2h: ainda dentro das 24h

    await db.quote.updateMany({ where: { id: soon }, data: { lastNudgeAt: new Date(Date.now() - 25 * 60 * 60 * 1000) } });
    expect(await ids()).toEqual([soon]); // 24h depois da cobrança volta
  });

  it("orçamento sem validade (null) ainda aparece como sem resposta", async () => {
    const u = await makeUser();
    loginAs(u.id);
    const id = await sentQuote();
    await db.quote.update({ where: { id }, data: { validUntil: null } });
    const rows = await db.quote.findMany({ where: { userId: u.id, ...staleWhere(new Date()) } });
    expect(rows.map((q) => q.id)).toEqual([id]);
  });
});

describe("funil de cobrança", () => {
  it("conta orçamentos cobrados e aprovados depois da cobrança, só do técnico e dos últimos 30 dias", async () => {
    const a = await makeUser();
    const b = await makeUser();
    loginAs(a.id);
    const won = await sentQuote();
    const lost = await sentQuote();
    const approvedBefore = await sentQuote();
    const old = await sentQuote();
    const snoozedOnly = await sentQuote();
    for (const id of [won, won, lost, approvedBefore, old]) await markQuoteNudged(id); // won cobrado 2x conta 1
    await snoozeQuoteFollowUp(snoozedOnly); // adiar não é cobrar
    await db.quote.update({ where: { id: won }, data: { status: "APPROVED", respondedAt: new Date(Date.now() + 1000) } });
    await db.quote.update({ where: { id: approvedBefore }, data: { status: "APPROVED", respondedAt: new Date(Date.now() - DAY) } });
    await db.quoteNudge.updateMany({ where: { quoteId: old }, data: { createdAt: new Date(Date.now() - 40 * DAY) } });

    const f = await getNudgeFunnel(a.id);
    expect(f).toMatchObject({ nudged: 3, approvedAfter: 1 });
    expect(f.approvedCents).toBeGreaterThan(0);
    expect(await getNudgeFunnel(b.id)).toEqual({ nudged: 0, approvedAfter: 0, approvedCents: 0 });
  });
});

describe("resumo semanal com funil", () => {
  it("inclui a linha do funil só quando houve cobrança", async () => {
    const u = await makeUser("f@t.com");
    loginAs(u.id);
    await sentQuote();
    expect(await sendWeeklyDigest()).toEqual({ users: 1, sent: 1 });
    expect(sent[0].text).not.toContain("você cobrou");

    sent.length = 0;
    const cobrado = await sentQuote();
    await markQuoteNudged(cobrado);
    await db.quote.update({ where: { id: cobrado }, data: { status: "APPROVED", respondedAt: new Date(Date.now() + 1000) } });
    expect(await sendWeeklyDigest()).toEqual({ users: 1, sent: 1 });
    expect(sent[0].text).toContain("você cobrou 1 cliente e 1 aprovou depois");
  });
});
