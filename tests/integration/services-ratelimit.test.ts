import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { listServices, removeService, restoreDefaultService, updateService } from "@/actions/services";
import { isRateLimited, rateLimit } from "@/lib/rate-limit";
import { loginAs, makeSystemService, makeUser, resetDb } from "../helpers/db";

beforeEach(resetDb);

describe("serviços: override de preço", () => {
  it("editar um padrão cria cópia do técnico e não altera o do sistema", async () => {
    const u = await makeUser();
    const base = await makeSystemService("Instalação", 45000);
    loginAs(u.id);

    const res = await updateService({ id: base.id, name: "Instalação", unit: "un", priceCents: 50000 });
    expect(res.ok).toBe(true);

    expect((await db.service.findUniqueOrThrow({ where: { id: base.id } })).priceCents).toBe(45000);
    const list = await listServices();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ priceCents: 50000, overridesId: base.id, name: "Instalação" });
  });

  it("override de um técnico não aparece para o outro", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const base = await makeSystemService("Limpeza", 18000);
    loginAs(a.id);
    await updateService({ id: base.id, name: "Limpeza", unit: "un", priceCents: 20000 });
    loginAs(b.id);
    expect((await listServices())[0]).toMatchObject({ id: base.id, priceCents: 18000 });
  });

  it("remover padrão oculta só para o técnico; restaurar devolve", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const base = await makeSystemService();
    loginAs(a.id);
    await removeService(base.id);
    expect(await listServices()).toHaveLength(0);
    loginAs(b.id);
    expect(await listServices()).toHaveLength(1);
    loginAs(a.id);
    await restoreDefaultService(base.id);
    expect(await listServices()).toHaveLength(1);
  });

  it("não edita serviço próprio de outro técnico", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const own = await db.service.create({ data: { userId: a.id, name: "Do A", unit: "un", priceCents: 100 } });
    loginAs(b.id);
    expect((await updateService({ id: own.id, name: "Hack", unit: "un", priceCents: 1 })).ok).toBe(false);
    expect((await db.service.findUniqueOrThrow({ where: { id: own.id } })).name).toBe("Do A");
  });
});

describe("rate limit", () => {
  it("bloqueia depois do limite e isLimited não consome", async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push((await rateLimit("k1", 3, 60)).ok);
    expect(results).toEqual([true, true, true, false]);
    expect(await isRateLimited("k1", 3)).toBe(true);
    expect((await db.rateLimit.findUniqueOrThrow({ where: { key: "k1" } })).count).toBe(4);
  });

  it("chaves são independentes", async () => {
    await rateLimit("a", 1, 60);
    await rateLimit("a", 1, 60);
    expect((await rateLimit("b", 1, 60)).ok).toBe(true);
  });

  it("janela vencida reinicia a contagem", async () => {
    await rateLimit("w", 1, 60);
    await rateLimit("w", 1, 60);
    await db.rateLimit.update({ where: { key: "w" }, data: { resetAt: new Date(Date.now() - 1000) } });
    expect((await rateLimit("w", 1, 60)).ok).toBe(true);
  });

  it("é atômico sob concorrência", async () => {
    const res = await Promise.all(Array.from({ length: 20 }, () => rateLimit("c", 5, 60)));
    expect(res.filter((r) => r.ok)).toHaveLength(5);
  });
});
