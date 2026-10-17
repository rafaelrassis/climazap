import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import {
  approveQuoteByPublicId,
  completeMaintenanceReminder,
  createQuote,
  setMaintenanceReminder,
} from "@/actions/quotes";
import { updateService } from "@/actions/services";
import { saveDefaultReminder, savePushSubscription } from "@/actions/settings";
import { notifyDueReminders } from "@/lib/maintenance-notify";
import { _resetPushConfig } from "@/lib/push";
import { loginAs, makeSystemService, makeUser, quoteInput, resetDb } from "../helpers/db";

const sendNotification = vi.fn();
vi.mock("web-push", () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: (...a: unknown[]) => sendNotification(...a) },
}));

// Simula falha no agendamento automático sem tocar no cliente Prisma (spyOn nele não restaura
// de forma confiável: os métodos do Prisma Client são getters, não funções simples).
let forceScheduleFailure = false;
vi.mock("@/lib/maintenance", async (orig) => {
  const actual = await orig<typeof import("@/lib/maintenance")>();
  return {
    ...actual,
    resolveReminder: (...args: Parameters<typeof actual.resolveReminder>) => {
      if (forceScheduleFailure) throw new Error("falha simulada no agendamento");
      return actual.resolveReminder(...args);
    },
  };
});

async function send(id: string) {
  await db.quote.update({ where: { id }, data: { status: "SENT", sentAt: new Date() } });
}

const DAY = 86_400_000;

beforeEach(async () => {
  await resetDb();
  sendNotification.mockReset();
  sendNotification.mockResolvedValue({});
  forceScheduleFailure = false;
});

describe("agendamento automático na aprovação", () => {
  it("vale o serviço de menor prazo entre os itens", async () => {
    const u = await makeUser();
    loginAs(u.id);
    const instalacao = await makeSystemService("Instalação");
    await db.service.update({ where: { id: instalacao.id }, data: { reminderMonths: 12 } });
    const limpeza = await makeSystemService("Limpeza");
    await db.service.update({ where: { id: limpeza.id }, data: { reminderMonths: 6, reminderText: "Hora de limpar, {cliente}!" } });

    const q = await createQuote(quoteInput({ items: [{ serviceId: instalacao.id, quantity: 1 }, { serviceId: limpeza.id, quantity: 1 }] }) as never);
    if (!q.ok) throw new Error(q.error);
    await send(q.data.id);
    await approveQuoteByPublicId(q.data.publicId);

    const row = await db.quote.findUniqueOrThrow({ where: { id: q.data.id } });
    expect(row.reminderService).toBe("Limpeza");
    expect(row.reminderText).toBe("Hora de limpar, {cliente}!");
    expect(row.reminderAt).not.toBeNull();
    const expected = new Date(row.respondedAt!.getTime());
    expected.setMonth(expected.getMonth() + 6);
    expect(Math.abs(row.reminderAt!.getTime() - expected.getTime())).toBeLessThan(5000);
  });

  it("sem serviço com prazo, cai no padrão do técnico", async () => {
    const u = await makeUser();
    loginAs(u.id);
    await saveDefaultReminder(3);
    const q = await createQuote(quoteInput() as never); // item avulso, sem serviceId
    if (!q.ok) throw new Error(q.error);
    await send(q.data.id);
    await approveQuoteByPublicId(q.data.publicId);

    const row = await db.quote.findUniqueOrThrow({ where: { id: q.data.id } });
    expect(row.reminderService).toBeNull();
    expect(row.reminderText).toBeNull();
    expect(row.reminderAt).not.toBeNull();
  });

  it("sem serviço com prazo e padrão desligado: sem lembrete", async () => {
    const u = await makeUser();
    loginAs(u.id);
    await saveDefaultReminder(null);
    const q = await createQuote(quoteInput() as never);
    if (!q.ok) throw new Error(q.error);
    await send(q.data.id);
    await approveQuoteByPublicId(q.data.publicId);

    const row = await db.quote.findUniqueOrThrow({ where: { id: q.data.id } });
    expect(row.reminderAt).toBeNull();
  });

  it("falha ao agendar não impede a aprovação", async () => {
    const u = await makeUser();
    loginAs(u.id);
    const q = await createQuote(quoteInput() as never);
    if (!q.ok) throw new Error(q.error);
    await send(q.data.id);

    forceScheduleFailure = true;
    const res = await approveQuoteByPublicId(q.data.publicId);
    forceScheduleFailure = false;

    expect(res.ok).toBe(true);
    const row = await db.quote.findUniqueOrThrow({ where: { id: q.data.id } });
    expect(row.status).toBe("APPROVED");
    expect(row.reminderAt).toBeNull(); // agendamento falhou, mas a aprovação valeu
  });

  it("serviço com override herda reminderMonths/reminderText do padrão", async () => {
    const base = await makeSystemService("Carga de gás", 25000);
    await db.service.update({ where: { id: base.id }, data: { reminderMonths: 12, reminderText: "Hora da carga, {cliente}" } });

    const u = await makeUser();
    loginAs(u.id);
    const res = await updateService({ id: base.id, name: base.name, unit: base.unit, priceCents: 30000 });
    if (!res.ok) throw new Error("falhou");
    const override = await db.service.findUniqueOrThrow({ where: { id: res.data.id } });
    expect(override.reminderMonths).toBe(12);
    expect(override.reminderText).toBe("Hora da carga, {cliente}");
    expect(override.priceCents).toBe(30000);
  });
});

describe("setMaintenanceReminder / completeMaintenanceReminder", () => {
  async function approvedQuote() {
    const u = await makeUser();
    loginAs(u.id);
    const q = await createQuote(quoteInput() as never);
    if (!q.ok) throw new Error(q.error);
    await send(q.data.id);
    await approveQuoteByPublicId(q.data.publicId);
    return q.data.id;
  }

  it("manual sempre usa a mensagem padrão (zera reminderText/reminderService) e zera reminderNotifiedAt", async () => {
    const id = await approvedQuote();
    await db.quote.update({ where: { id }, data: { reminderText: "algo", reminderService: "X", reminderNotifiedAt: new Date() } });
    expect((await setMaintenanceReminder(id, 6)).ok).toBe(true);
    const row = await db.quote.findUniqueOrThrow({ where: { id } });
    expect(row.reminderText).toBeNull();
    expect(row.reminderService).toBeNull();
    expect(row.reminderNotifiedAt).toBeNull();
    expect(row.reminderAt).not.toBeNull();
  });

  it("Feito sem próxima data: só marca reminderDoneAt", async () => {
    const id = await approvedQuote();
    await setMaintenanceReminder(id, 6);
    expect((await completeMaintenanceReminder(id)).ok).toBe(true);
    const row = await db.quote.findUniqueOrThrow({ where: { id } });
    expect(row.reminderDoneAt).not.toBeNull();
  });

  it("Feito com próxima data: rearma e zera reminderDoneAt/reminderNotifiedAt", async () => {
    const id = await approvedQuote();
    await setMaintenanceReminder(id, 6);
    const before = (await db.quote.findUniqueOrThrow({ where: { id } })).reminderAt!;
    expect((await completeMaintenanceReminder(id, 12)).ok).toBe(true);
    const row = await db.quote.findUniqueOrThrow({ where: { id } });
    expect(row.reminderDoneAt).toBeNull();
    expect(row.reminderNotifiedAt).toBeNull();
    expect(row.reminderAt!.getTime()).toBeGreaterThan(before.getTime());
  });

  it("técnico não vê nem aciona lembrete de outro", async () => {
    const idA = await approvedQuote();
    await setMaintenanceReminder(idA, 6);
    const b = await makeUser();
    loginAs(b.id);
    expect((await setMaintenanceReminder(idA, 3)).ok).toBe(false);
    expect((await completeMaintenanceReminder(idA)).ok).toBe(false);
  });
});

describe("notifyDueReminders", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub";
    process.env.VAPID_PRIVATE_KEY = "priv";
    process.env.VAPID_SUBJECT = "mailto:t@t.com";
    _resetPushConfig();
  });

  async function dueQuote(userId: string, n: number) {
    loginAs(userId);
    const q = await createQuote(quoteInput({ customerPhone: `1199999${String(n).padStart(4, "0")}` }) as never);
    if (!q.ok) throw new Error(q.error);
    await send(q.data.id);
    await approveQuoteByPublicId(q.data.publicId);
    await db.quote.update({ where: { id: q.data.id }, data: { reminderAt: new Date(Date.now() - DAY), reminderDoneAt: null, reminderNotifiedAt: null } });
    return q.data.id;
  }

  it("1 push por técnico com N vencidos; marca reminderNotifiedAt só se enviou; não repete no 2º disparo", async () => {
    const a = await makeUser("a@t.com");
    const b = await makeUser("b@t.com"); // sem aparelho cadastrado
    loginAs(a.id);
    await savePushSubscription({
      endpoint: "https://push.example.com/a",
      keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" },
    });

    const a1 = await dueQuote(a.id, 1);
    const a2 = await dueQuote(a.id, 2);
    await dueQuote(b.id, 3);

    const now = new Date();
    const result = await notifyDueReminders(now);
    expect(result.notified).toBe(2); // só os 2 do técnico A, que tem aparelho
    expect(sendNotification).toHaveBeenCalledTimes(1); // 1 push pro A (B não tem assinatura, nem chama)

    expect((await db.quote.findUniqueOrThrow({ where: { id: a1 } })).reminderNotifiedAt).not.toBeNull();
    expect((await db.quote.findUniqueOrThrow({ where: { id: a2 } })).reminderNotifiedAt).not.toBeNull();

    sendNotification.mockClear();
    const second = await notifyDueReminders(new Date());
    expect(second.notified).toBe(0); // já notificado: não repete
    expect(sendNotification).not.toHaveBeenCalled();
  });
});
