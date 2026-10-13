import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatBRL } from "@/lib/money";

export type QuotePdfData = {
  number: number;
  senderName: string;
  customerName: string;
  title?: string | null;
  notes?: string | null;
  status: string;
  createdAt: Date;
  validUntil: Date | null;
  discountCents: number;
  totalCents: number;
  items: { description: string; unit: string; quantity: number; unitPriceCents: number; totalCents: number }[];
  logoPng?: Uint8Array | null;
  brandColor?: string | null; // "#rrggbb"
  pix?: { key: string; payload: string } | null;
};

const A4 = { w: 595.28, h: 841.89 };
const M = 48; // margem
const fmtDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });
const qty = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

// Fonte padrão do PDF só codifica WinAnsi (Latin-1 + pontuação comum): troca o que não couber por "?"
function safe(font: PDFFont, text: string): string {
  let out = "";
  for (const ch of text.replace(/\s+/g, " ").normalize("NFC")) {
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      out += "?";
    }
  }
  return out;
}

function wrap(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const words = safe(font, text).split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    let w = word;
    // palavra maior que a linha: quebra por caractere
    while (font.widthOfTextAtSize(w, size) > maxWidth) {
      let cut = w.length - 1;
      while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut), size) > maxWidth) cut--;
      if (line) {
        lines.push(line);
        line = "";
      }
      lines.push(w.slice(0, cut));
      w = w.slice(cut);
    }
    const candidate = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function hexToRgb(hex?: string | null) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex ?? "");
  return m ? rgb(parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255) : rgb(0.06, 0.09, 0.16);
}

export async function buildQuotePdf(d: QuotePdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Orçamento #${d.number}`);
  pdf.setAuthor(d.senderName.slice(0, 80));
  pdf.setCreator("FechouClima");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const accent = hexToRgb(d.brandColor);
  const gray = rgb(0.4, 0.45, 0.52);
  const ink = rgb(0.06, 0.09, 0.16);

  let page: PDFPage = pdf.addPage([A4.w, A4.h]);
  let y = A4.h - M;
  const contentW = A4.w - 2 * M;

  const ensure = (need: number) => {
    if (y - need < M + 30) {
      page = pdf.addPage([A4.w, A4.h]);
      y = A4.h - M;
    }
  };
  const text = (s: string, x: number, size: number, f: PDFFont = font, color = ink) =>
    page.drawText(safe(f, s), { x, y, size, font: f, color });

  // Cabeçalho: logo (PNG) ou nome do emissor
  let headerH = 0;
  if (d.logoPng) {
    try {
      const img = await pdf.embedPng(d.logoPng);
      const s = Math.min(150 / img.width, 54 / img.height, 1);
      page.drawImage(img, { x: M, y: y - img.height * s, width: img.width * s, height: img.height * s });
      headerH = img.height * s;
    } catch {
      /* logo inválida: segue sem ela */
    }
  }
  if (!headerH) {
    page.drawText(safe(bold, d.senderName).slice(0, 48), { x: M, y: y - 18, size: 18, font: bold, color: accent });
    headerH = 22;
  } else {
    page.drawText(safe(font, d.senderName).slice(0, 48), { x: M + 165, y: y - headerH / 2 - 4, size: 12, font, color: gray });
  }
  const numLabel = `Orçamento #${d.number}`;
  page.drawText(numLabel, { x: A4.w - M - bold.widthOfTextAtSize(numLabel, 16), y: y - 16, size: 16, font: bold, color: ink });
  const dateLabel = `Emitido em ${fmtDate.format(d.createdAt)}`;
  page.drawText(dateLabel, { x: A4.w - M - font.widthOfTextAtSize(dateLabel, 10), y: y - 32, size: 10, font, color: gray });
  y -= Math.max(headerH, 40) + 10;
  page.drawRectangle({ x: M, y, width: contentW, height: 2, color: accent });
  y -= 24;

  text("Cliente", M, 9, font, gray);
  y -= 14;
  text(d.customerName.slice(0, 80), M, 13, bold);
  y -= 6;
  if (d.title) {
    for (const l of wrap(font, d.title, 11, contentW)) {
      y -= 15;
      text(l, M, 11, font, gray);
    }
  }
  y -= 26;

  // Tabela de itens
  const cDesc = M;
  const cQty = M + contentW * 0.56;
  const cUnit = M + contentW * 0.7;
  const cTotal = A4.w - M;
  const head = () => {
    page.drawRectangle({ x: M, y: y - 6, width: contentW, height: 22, color: rgb(0.95, 0.96, 0.98) });
    text("Descrição", cDesc + 6, 9, bold, gray);
    text("Qtd", cQty, 9, bold, gray);
    text("Unitário", cUnit, 9, bold, gray);
    page.drawText("Total", { x: cTotal - 6 - bold.widthOfTextAtSize("Total", 9), y, size: 9, font: bold, color: gray });
    y -= 26;
  };
  head();

  for (const it of d.items) {
    const lines = wrap(font, it.description, 10.5, contentW * 0.5);
    ensure(lines.length * 14 + 14);
    if (y > A4.h - M - 5) head();
    const top = y;
    lines.forEach((l, i) => page.drawText(l, { x: cDesc + 6, y: top - i * 14, size: 10.5, font, color: ink }));
    page.drawText(`${qty(it.quantity)} ${safe(font, it.unit)}`, { x: cQty, y: top, size: 10.5, font, color: ink });
    page.drawText(formatBRL(it.unitPriceCents), { x: cUnit, y: top, size: 10.5, font, color: ink });
    const tot = formatBRL(it.totalCents);
    page.drawText(tot, { x: cTotal - 6 - bold.widthOfTextAtSize(tot, 10.5), y: top, size: 10.5, font: bold, color: ink });
    y -= lines.length * 14 + 6;
    page.drawLine({ start: { x: M, y: y + 2 }, end: { x: cTotal, y: y + 2 }, thickness: 0.5, color: rgb(0.88, 0.9, 0.93) });
    y -= 10;
  }

  // Totais
  ensure(110);
  if (d.discountCents > 0) {
    const sub = formatBRL(d.totalCents + d.discountCents);
    const disc = `-${formatBRL(d.discountCents)}`;
    text("Subtotal", cUnit, 10, font, gray);
    page.drawText(sub, { x: cTotal - 6 - font.widthOfTextAtSize(sub, 10), y, size: 10, font, color: gray });
    y -= 16;
    text("Desconto", cUnit, 10, font, gray);
    page.drawText(disc, { x: cTotal - 6 - font.widthOfTextAtSize(disc, 10), y, size: 10, font, color: gray });
    y -= 34;
  }
  page.drawRectangle({ x: cUnit - 10, y: y - 10, width: cTotal - cUnit + 10, height: 32, color: accent });
  page.drawText("TOTAL", { x: cUnit, y: y + 2, size: 11, font: bold, color: rgb(1, 1, 1) });
  const tt = formatBRL(d.totalCents);
  page.drawText(tt, { x: cTotal - 8 - bold.widthOfTextAtSize(tt, 15), y: y + 1, size: 15, font: bold, color: rgb(1, 1, 1) });
  y -= 44;

  if (d.validUntil) {
    ensure(20);
    text(`Válido até ${fmtDate.format(d.validUntil)}`, M, 10, font, gray);
    y -= 18;
  }
  if (d.notes) {
    ensure(40);
    text("Observações", M, 9, font, gray);
    y -= 14;
    for (const l of wrap(font, d.notes, 10.5, contentW)) {
      ensure(16);
      text(l, M, 10.5);
      y -= 14;
    }
    y -= 6;
  }
  if (d.pix) {
    ensure(70);
    text("Pagamento via Pix", M, 9, font, gray);
    y -= 14;
    text(`Chave: ${d.pix.key}`, M, 11, bold);
    y -= 15;
    for (const l of wrap(font, `Pix copia e cola: ${d.pix.payload}`, 7.5, contentW)) {
      ensure(12);
      text(l, M, 7.5, font, gray);
      y -= 10;
    }
  }

  // Rodapé em todas as páginas
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    const foot = `FechouClima · fechouclima.com.br · página ${i + 1} de ${pages.length}`;
    p.drawText(foot, { x: A4.w / 2 - font.widthOfTextAtSize(foot, 8) / 2, y: 24, size: 8, font, color: gray });
  });

  return pdf.save();
}
