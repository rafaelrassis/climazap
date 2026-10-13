import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createQuote } from "@/actions/quotes";
import { GET } from "@/app/o/[publicId]/pdf/route";
import { loginAs, makeUser, quoteInput, resetDb } from "../helpers/db";

beforeEach(resetDb);

const get = (publicId: string) => GET(new Request("http://x"), { params: Promise.resolve({ publicId }) });
const hasPdftotext = spawnSync("pdftotext", ["-v"]).status !== null;

async function quote(status: "DRAFT" | "SENT" | "APPROVED") {
  loginAs((await makeUser()).id);
  const q = await createQuote(quoteInput({ customerName: "Cliente do PDF", customerPhone: "(11) 98765-4321", customerAddress: "Rua Secreta, 99" }) as never);
  if (!q.ok) throw new Error(q.error);
  await db.quote.update({ where: { id: q.data.id }, data: { status } });
  return q.data;
}

describe("rota pública do PDF", () => {
  it("devolve PDF para orçamento enviado, com cabeçalhos seguros", async () => {
    const q = await quote("SENT");
    const res = await get(q.publicId);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toBe(`inline; filename="orcamento-${q.number}.pdf"`);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cache-control")).toContain("no-store");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
  });

  it("aprovado também tem PDF; rascunho, inexistente e malformado dão 404", async () => {
    expect((await get((await quote("APPROVED")).publicId)).status).toBe(200);
    expect((await get((await quote("DRAFT")).publicId)).status).toBe(404);
    expect((await get("00000000-0000-4000-8000-000000000000")).status).toBe(404);
    expect((await get("nao-uuid")).status).toBe(404);
  });

  it.skipIf(!hasPdftotext)("não expõe telefone nem endereço do cliente", async () => {
    const q = await quote("SENT");
    const file = join(mkdtempSync(join(tmpdir(), "pdf-")), "q.pdf");
    writeFileSync(file, new Uint8Array(await (await get(q.publicId)).arrayBuffer()));
    const text = spawnSync("pdftotext", [file, "-"], { encoding: "utf8" }).stdout;
    expect(text).toContain("Cliente do PDF");
    expect(text).not.toContain("98765");
    expect(text).not.toContain("Rua Secreta");
  });

  it("limita a 30 downloads por IP em 10 minutos", async () => {
    const q = await quote("SENT");
    const results = [];
    for (let i = 0; i < 32; i++) results.push((await get(q.publicId)).status);
    expect(results.filter((s) => s === 200)).toHaveLength(30);
    expect(results.filter((s) => s === 429)).toHaveLength(2);
  });
});
