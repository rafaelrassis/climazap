// Pix estático (BR Code / EMV-MPM). Spec: Manual do BR Code do Banco Central.
export type PixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "RANDOM";

const digits = (s: string) => s.replace(/\D/g, "");

function validCpf(d: string): boolean {
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  for (const len of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const dv = ((sum * 10) % 11) % 10;
    if (dv !== Number(d[len])) return false;
  }
  return true;
}

function validCnpj(d: string): boolean {
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  for (const len of [12, 13]) {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, w, i) => acc + w * Number(d[i]), 0);
    const dv = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (dv !== Number(d[len])) return false;
  }
  return true;
}

// Reconhece e normaliza a chave como o Pix exige: CPF/CNPJ só dígitos, telefone +55..., e-mail minúsculo, aleatória (UUID)
export function normalizePixKey(raw: string): { type: PixKeyType; key: string } | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return { type: "RANDOM", key: v.toLowerCase() };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return v.length <= 77 ? { type: "EMAIL", key: v.toLowerCase() } : null;
  const d = digits(v);
  // Telefone só quando é inequívoco: com "+55" ou formatado "(11) 99999-0000". Dígitos soltos são tratados como CPF/CNPJ,
  // porque um CPF digitado errado não pode virar, em silêncio, uma chave de telefone (o Pix iria para a chave errada).
  if (v.startsWith("+")) return /^55\d{10,11}$/.test(d) ? { type: "PHONE", key: `+${d}` } : null;
  if (/^\(\d{2}\)/.test(v)) return /^[1-9]{2}9?\d{8}$/.test(d) ? { type: "PHONE", key: `+55${d}` } : null;
  if (/^[\d.\-/\s]+$/.test(v)) {
    if (validCpf(d)) return { type: "CPF", key: d };
    if (validCnpj(d)) return { type: "CNPJ", key: d };
  }
  return null;
}

// CRC16/CCITT-FALSE (poly 0x1021, init 0xFFFF)
export function crc16(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

const tlv = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;

// Nome e cidade do recebedor: ASCII maiúsculo, sem acentos, limites do BR Code (25 e 15)
export function pixText(s: string, max: number): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, max)
    .trim();
}

export function buildPixPayload(o: { key: string; name: string; city: string; amountCents?: number; txid?: string }): string {
  const name = pixText(o.name, 25) || "RECEBEDOR";
  const city = pixText(o.city, 15) || "BRASIL";
  const txid = (o.txid ?? "***").replace(/[^A-Za-z0-9*]/g, "").slice(0, 25) || "***";

  let payload =
    tlv("00", "01") +
    tlv("01", "11") +
    tlv("26", tlv("00", "br.gov.bcb.pix") + tlv("01", o.key)) +
    tlv("52", "0000") +
    tlv("53", "986");
  if (o.amountCents && o.amountCents > 0) payload += tlv("54", (o.amountCents / 100).toFixed(2));
  payload += tlv("58", "BR") + tlv("59", name) + tlv("60", city) + tlv("62", tlv("05", txid));
  payload += "6304";
  return payload + crc16(payload);
}

// Leitura do TLV (usada nos testes para conferir o payload gerado)
export function parsePixPayload(payload: string): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  while (i + 4 <= payload.length) {
    const id = payload.slice(i, i + 2);
    const len = Number(payload.slice(i + 2, i + 4));
    out[id] = payload.slice(i + 4, i + 4 + len);
    i += 4 + len;
  }
  return out;
}
