import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createQuote } from "@/actions/quotes";
import { removePix, saveBrandColor, savePix } from "@/actions/settings";
import { GET as pdf } from "@/app/o/[publicId]/pdf/route";
import { loginAs, makeUser, quoteInput, resetDb } from "../helpers/db";

beforeEach(resetDb);
const hasPdftotext = spawnSync("pdftotext", ["-v"]).status !== null;

describe("configuração do Pix do técnico", () => {
  it("normaliza a chave, guarda tipo e cidade sem acento", async () => {
    const u = await makeUser();
    loginAs(u.id);
    expect((await savePix("529.982.247-25", "São José do Rio Preto")).ok).toBe(true);
    expect(await db.user.findUniqueOrThrow({ where: { id: u.id }, select: { pixKey: true, pixKeyType: true, pixCity: true } })).toEqual({
      pixKey: "52998224725",
      pixKeyType: "CPF",
      pixCity: "SAO JOSE DO RIO",
    });
    expect((await savePix("(11) 99999-0000", "Campinas")).ok).toBe(true);
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).pixKey).toBe("+5511999990000");
  });

  it("recusa chave inválida, ambígua (11 dígitos soltos), cidade curta e não altera o que já estava salvo", async () => {
    const u = await makeUser();
    loginAs(u.id);
    await savePix("tec@exemplo.com", "Santos");
    for (const [key, city] of [["529.982.247-26", "Santos"], ["11999990000", "Santos"], ["abc", "Santos"], ["", "Santos"], ["tec@exemplo.com", "X"]] as const) {
      const res = await savePix(key, city);
      expect(res.ok, key).toBe(false);
    }
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).pixKey).toBe("tec@exemplo.com");
  });

  it("remover limpa os três campos; um técnico não mexe no Pix de outro", async () => {
    const a = await makeUser();
    const b = await makeUser();
    loginAs(a.id);
    await savePix("a@a.com", "Santos");
    loginAs(b.id);
    await removePix();
    expect((await db.user.findUniqueOrThrow({ where: { id: a.id } })).pixKey).toBe("a@a.com");
    loginAs(a.id);
    await removePix();
    expect(await db.user.findUniqueOrThrow({ where: { id: a.id }, select: { pixKey: true, pixKeyType: true, pixCity: true } })).toEqual({ pixKey: null, pixKeyType: null, pixCity: null });
  });
});

describe("Pix no PDF do orçamento", () => {
  async function approvedQuote(withPix: boolean, status: "SENT" | "APPROVED" = "APPROVED") {
    const u = await makeUser();
    loginAs(u.id);
    if (withPix) await savePix("tec@exemplo.com", "Santos");
    const q = await createQuote(quoteInput() as never); // total R$ 200,00
    if (!q.ok) throw new Error(q.error);
    await db.quote.update({ where: { id: q.data.id }, data: { status } });
    return q.data;
  }
  const text = async (publicId: string) => {
    const res = await pdf(new Request("http://x"), { params: Promise.resolve({ publicId }) });
    const file = join(mkdtempSync(join(tmpdir(), "pdf-")), "q.pdf");
    writeFileSync(file, new Uint8Array(await res.arrayBuffer()));
    return spawnSync("pdftotext", ["-layout", file, "-"], { encoding: "utf8" }).stdout;
  };

  it.skipIf(!hasPdftotext)("aprovado e com Pix configurado: PDF traz a chave e o copia e cola com o valor", async () => {
    const q = await approvedQuote(true);
    const t = await text(q.publicId);
    expect(t).toContain("Pagamento via Pix");
    expect(t).toContain("Chave: tec@exemplo.com");
    expect(t.replace(/\s/g, "")).toContain("5406200.00"); // campo 54 (valor) do BR Code
  });

  it.skipIf(!hasPdftotext)("não mostra Pix antes da aprovação nem sem Pix configurado", async () => {
    expect(await text((await approvedQuote(true, "SENT")).publicId)).not.toContain("Pix");
    expect(await text((await approvedQuote(false)).publicId)).not.toContain("Pix");
  });
});

describe("cor da marca (ação)", () => {
  it("salva cor da paleta, volta ao padrão com null e recusa o resto", async () => {
    const u = await makeUser();
    loginAs(u.id);
    expect((await saveBrandColor("#1d4ed8")).ok).toBe(true);
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).brandColor).toBe("#1d4ed8");
    expect((await saveBrandColor("#0f172a")).ok).toBe(true); // padrão: guarda null
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).brandColor).toBeNull();
    for (const bad of ["#ffff00", "red", "#1d4ed8;x", ""]) expect((await saveBrandColor(bad)).ok, bad).toBe(false);
    await saveBrandColor("#be123c");
    expect((await saveBrandColor("<script>")).ok).toBe(false);
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).brandColor).toBe("#be123c");
  });

  it("um técnico não altera a cor de outro", async () => {
    const a = await makeUser();
    const b = await makeUser();
    loginAs(a.id);
    await saveBrandColor("#0b6e4f");
    loginAs(b.id);
    await saveBrandColor("#c2410c");
    expect((await db.user.findUniqueOrThrow({ where: { id: a.id } })).brandColor).toBe("#0b6e4f");
  });
});
