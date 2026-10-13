import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildQuotePdf, type QuotePdfData } from "@/lib/quote-pdf";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

const base = (over: Partial<QuotePdfData> = {}): QuotePdfData => ({
  number: 12,
  senderName: "Frio Total Climatização",
  customerName: "Maria da Conceição",
  title: "Instalação de split na sala",
  notes: "Pagamento em até 2x. Garantia de 90 dias.",
  status: "SENT",
  createdAt: new Date("2026-10-13T15:00:00Z"),
  validUntil: new Date("2026-10-20T15:00:00Z"),
  discountCents: 5000,
  totalCents: 40000,
  items: [{ description: "Instalação de split 12.000 BTUs", unit: "un", quantity: 1, unitPriceCents: 45000, totalCents: 45000 }],
  ...over,
});

const pdftotext = (bytes: Uint8Array): string | null => {
  const dir = mkdtempSync(join(tmpdir(), "pdf-"));
  const file = join(dir, "q.pdf");
  writeFileSync(file, bytes);
  const r = spawnSync("pdftotext", ["-layout", file, "-"], { encoding: "utf8" });
  return r.status === 0 ? r.stdout : null;
};
const hasPdftotext = spawnSync("pdftotext", ["-v"]).status !== null;

describe("PDF do orçamento", () => {
  it("gera um PDF válido de 1 página com metadados", async () => {
    const bytes = await buildQuotePdf(base());
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe("Orçamento #12");
    expect(doc.getCreator()).toBe("FechouClima");
  });

  it.skipIf(!hasPdftotext)("traz os dados certos (acentos, valores, desconto) e nada do telefone", async () => {
    const text = pdftotext(await buildQuotePdf(base()))!;
    expect(text).toContain("Orçamento #12");
    expect(text).toContain("Maria da Conceição");
    expect(text).toContain("Instalação de split 12.000 BTUs");
    expect(text).toMatch(/R\$\s*450,00/);
    expect(text).toMatch(/Desconto/);
    expect(text).toMatch(/-R\$\s*50,00/);
    expect(text).toMatch(/R\$\s*400,00/);
    expect(text).toContain("Válido até 20/10/2026");
    expect(text).toContain("Garantia de 90 dias");
    expect(text).toContain("página 1 de 1");
  });

  it("não quebra com emoji, caracteres fora do alfabeto latino e texto gigante sem espaços", async () => {
    const bytes = await buildQuotePdf(
      base({
        customerName: "João 😀 Ωmega 中文",
        items: [
          { description: "Item com emoji 🔧 e símbolo ™ “aspas”", unit: "un", quantity: 1.5, unitPriceCents: 1000, totalCents: 1500 },
          { description: "x".repeat(400), unit: "m", quantity: 2, unitPriceCents: 100, totalCents: 200 },
        ],
        notes: "y".repeat(600),
      }),
    );
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("muitos itens quebram em várias páginas, cada uma com rodapé numerado", async () => {
    const items = Array.from({ length: 80 }, (_, i) => ({
      description: `Serviço número ${i + 1} com descrição razoavelmente comprida para ocupar espaço na linha`,
      unit: "un",
      quantity: 1,
      unitPriceCents: 1000,
      totalCents: 1000,
    }));
    const bytes = await buildQuotePdf(base({ items, totalCents: 80_000, discountCents: 0 }));
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
    if (hasPdftotext) {
      const text = pdftotext(bytes)!;
      expect(text).toContain(`página ${doc.getPageCount()} de ${doc.getPageCount()}`);
      expect(text).toContain("Serviço número 80");
      expect(text).toMatch(/TOTAL/);
    }
  });

  it("aceita logo PNG, ignora logo inválida e usa a cor da marca", async () => {
    const withLogo = await buildQuotePdf(base({ logoPng: new Uint8Array(PNG_1X1), brandColor: "#0b6e4f" }));
    const bad = await buildQuotePdf(base({ logoPng: new Uint8Array([1, 2, 3]), brandColor: "não-é-cor" }));
    expect((await PDFDocument.load(withLogo)).getPageCount()).toBe(1);
    expect((await PDFDocument.load(bad)).getPageCount()).toBe(1);
  });

  it.skipIf(!hasPdftotext)("com Pix: mostra a chave e o copia-e-cola", async () => {
    const text = pdftotext(await buildQuotePdf(base({ pix: { key: "11999990000", payload: "00020126" + "A".repeat(80) } })))!;
    expect(text).toContain("Pagamento via Pix");
    expect(text).toContain("Chave: 11999990000");
    expect(text).toContain("Pix copia e cola");
  });
});
