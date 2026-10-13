import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { removePushSubscription, savePushSubscription } from "@/actions/settings";
import { _resetPushConfig, sendPushToUser } from "@/lib/push";
import { loginAs, makeUser, resetDb } from "../helpers/db";

const sendNotification = vi.fn();
vi.mock("web-push", () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: (...a: unknown[]) => sendNotification(...a) },
}));

const sub = (n: number) => ({
  endpoint: `https://push.example.com/send/${n}`,
  keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" },
});

beforeEach(async () => {
  await resetDb();
  sendNotification.mockReset();
  sendNotification.mockResolvedValue({});
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub";
  process.env.VAPID_PRIVATE_KEY = "priv";
  process.env.VAPID_SUBJECT = "mailto:t@t.com";
  _resetPushConfig();
});

describe("assinaturas de push", () => {
  it("salva, atualiza por endpoint e valida o formato", async () => {
    const u = await makeUser();
    loginAs(u.id);
    expect((await savePushSubscription(sub(1), "UA")).ok).toBe(true);
    expect((await savePushSubscription(sub(1))).ok).toBe(true); // mesmo endpoint: upsert, não duplica
    expect(await db.pushSubscription.count({ where: { userId: u.id } })).toBe(1);

    expect((await savePushSubscription({ endpoint: "http://inseguro.com/x", keys: sub(1).keys })).ok).toBe(false);
    expect((await savePushSubscription({ endpoint: "https://ok.com/x", keys: { p256dh: "a", auth: "b" } })).ok).toBe(false);
  });

  it("outro técnico no mesmo aparelho assume a assinatura; remover só afeta o dono", async () => {
    const a = await makeUser();
    const b = await makeUser();
    loginAs(a.id);
    await savePushSubscription(sub(1));
    loginAs(b.id);
    expect((await removePushSubscription(sub(1).endpoint)).ok).toBe(true); // não é do B: nada apagado
    expect(await db.pushSubscription.count()).toBe(1);
    await savePushSubscription(sub(1)); // B entra no mesmo navegador
    expect((await db.pushSubscription.findFirstOrThrow()).userId).toBe(b.id);
    expect((await removePushSubscription(sub(1).endpoint)).ok).toBe(true);
    expect(await db.pushSubscription.count()).toBe(0);
  });
});

describe("sendPushToUser", () => {
  it("envia para todos os aparelhos do técnico e só dele", async () => {
    const a = await makeUser();
    const b = await makeUser();
    loginAs(a.id);
    await savePushSubscription(sub(1));
    await savePushSubscription(sub(2));
    loginAs(b.id);
    await savePushSubscription(sub(3));

    const delivered = await sendPushToUser(a.id, { title: "Fechou!", body: "R$ 450,00", url: "/orcamentos/x" });
    expect(delivered).toBe(2);
    expect(sendNotification).toHaveBeenCalledTimes(2);
    const endpoints = sendNotification.mock.calls.map((c) => c[0].endpoint).sort();
    expect(endpoints).toEqual([sub(1).endpoint, sub(2).endpoint]);
    expect(JSON.parse(sendNotification.mock.calls[0][1])).toMatchObject({ title: "Fechou!", url: "/orcamentos/x" });
  });

  it("remove assinatura expirada (410/404) e mantém as demais", async () => {
    const u = await makeUser();
    loginAs(u.id);
    await savePushSubscription(sub(1));
    await savePushSubscription(sub(2));
    sendNotification.mockImplementation(async (s: { endpoint: string }) => {
      if (s.endpoint === sub(1).endpoint) throw Object.assign(new Error("gone"), { statusCode: 410 });
      return {};
    });
    expect(await sendPushToUser(u.id, { title: "t", body: "b", url: "/inicio" })).toBe(1);
    const left = await db.pushSubscription.findMany();
    expect(left.map((l) => l.endpoint)).toEqual([sub(2).endpoint]);
  });

  it("erro transitório não apaga a assinatura nem lança", async () => {
    const u = await makeUser();
    loginAs(u.id);
    await savePushSubscription(sub(1));
    sendNotification.mockRejectedValue(Object.assign(new Error("boom"), { statusCode: 500 }));
    expect(await sendPushToUser(u.id, { title: "t", body: "b", url: "/inicio" })).toBe(0);
    expect(await db.pushSubscription.count()).toBe(1);
  });

  it("sem chaves VAPID configuradas, não envia nada", async () => {
    const u = await makeUser();
    loginAs(u.id);
    await savePushSubscription(sub(1));
    delete process.env.VAPID_PRIVATE_KEY;
    _resetPushConfig();
    expect(await sendPushToUser(u.id, { title: "t", body: "b", url: "/inicio" })).toBe(0);
    expect(sendNotification).not.toHaveBeenCalled();
  });
});
