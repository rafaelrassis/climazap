import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { POST } from "@/app/api/descadastro/route";
import { unsubscribePostUrl, unsubscribeUrl, verifyUnsubscribeToken } from "@/lib/unsubscribe";
import { makeUser, resetDb } from "../helpers/db";

beforeEach(resetDb);

const BASE = "http://localhost:3000";
const tokenOf = (url: string) => new URL(url).searchParams.get("t")!;

describe("descadastro por link assinado", () => {
  it("token válido só para o próprio usuário", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const t = tokenOf(unsubscribeUrl(a.id, BASE));
    expect(verifyUnsubscribeToken(a.id, t)).toBe(true);
    expect(verifyUnsubscribeToken(b.id, t)).toBe(false);
    expect(verifyUnsubscribeToken(a.id, "0".repeat(64))).toBe(false);
    expect(verifyUnsubscribeToken(a.id, "curto")).toBe(false);
    expect(verifyUnsubscribeToken("", t)).toBe(false);
  });

  it("POST com token válido desativa o resumo (JSON para clientes de e-mail)", async () => {
    const u = await makeUser();
    const res = await POST(new Request(unsubscribePostUrl(u.id, BASE), { method: "POST" }));
    expect(res.status).toBe(200);
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).emailDigest).toBe(false);
  });

  it("POST do navegador (Accept html) redireciona para a confirmação", async () => {
    const u = await makeUser();
    const res = await POST(new Request(unsubscribePostUrl(u.id, BASE), { method: "POST", headers: { accept: "text/html" } }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/descadastro?feito=1");
  });

  it("token inválido ou de outro usuário: 403 e nada muda", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const forB = unsubscribePostUrl(b.id, BASE).replace(b.id, a.id); // token do B com id do A
    expect((await POST(new Request(forB, { method: "POST" }))).status).toBe(403);
    expect((await POST(new Request(`${BASE}/api/descadastro?u=${a.id}&t=${"a".repeat(64)}`, { method: "POST" }))).status).toBe(403);
    expect((await POST(new Request(`${BASE}/api/descadastro`, { method: "POST" }))).status).toBe(403);
    expect((await db.user.findUniqueOrThrow({ where: { id: a.id } })).emailDigest).toBe(true);
  });
});
