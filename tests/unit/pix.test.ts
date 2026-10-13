import { describe, expect, it } from "vitest";
import { buildPixPayload, crc16, normalizePixKey, parsePixPayload, pixText } from "@/lib/pix";

describe("CRC16 e BR Code", () => {
  it("CRC16/CCITT-FALSE confere com o valor de referência da especificação", () => {
    expect(crc16("123456789")).toBe("29B1");
  });

  it("reproduz o exemplo do Manual do BR Code do Banco Central", () => {
    const sample =
      "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304";
    expect(crc16(sample)).toBe("1D3D");
  });

  it("payload com valor: campos corretos e CRC válido no final", () => {
    const p = buildPixPayload({ key: "+5511999990000", name: "Frio Total Climatização", city: "São Paulo", amountCents: 125_050 });
    const f = parsePixPayload(p);
    expect(f["00"]).toBe("01");
    expect(f["52"]).toBe("0000");
    expect(f["53"]).toBe("986");
    expect(f["54"]).toBe("1250.50");
    expect(f["58"]).toBe("BR");
    expect(f["59"]).toBe("FRIO TOTAL CLIMATIZACAO"); // maiúsculo e sem acento
    expect(f["60"]).toBe("SAO PAULO");
    expect(parsePixPayload(f["26"])).toEqual({ "00": "br.gov.bcb.pix", "01": "+5511999990000" });
    expect(parsePixPayload(f["62"])).toEqual({ "05": "***" });
    expect(p.slice(-8, -4)).toBe("6304");
    expect(p.slice(-4)).toBe(crc16(p.slice(0, -4)));
    expect(f["63"]).toHaveLength(4);
  });

  it("sem valor omite o campo 54; nome e cidade vazios ganham padrão", () => {
    const f = parsePixPayload(buildPixPayload({ key: "a@b.com", name: "", city: "" }));
    expect(f["54"]).toBeUndefined();
    expect(f["59"]).toBe("RECEBEDOR");
    expect(f["60"]).toBe("BRASIL");
  });

  it("limita nome (25) e cidade (15) e tira acentos e símbolos", () => {
    expect(pixText("João & Maria — Ar-Condicionado Ltda ME", 25)).toBe("JOAO MARIA AR CONDICIONAD");
    expect(pixText("Ribeirão Preto do Sul", 15)).toBe("RIBEIRAO PRETO");
  });
});

describe("normalização da chave Pix", () => {
  it("CPF e CNPJ válidos viram só dígitos; inválidos são recusados", () => {
    expect(normalizePixKey("529.982.247-25")).toEqual({ type: "CPF", key: "52998224725" });
    expect(normalizePixKey("11.222.333/0001-81")).toEqual({ type: "CNPJ", key: "11222333000181" });
    expect(normalizePixKey("111.111.111-11")).toBeNull();
    expect(normalizePixKey("529.982.247-26")).toBeNull();
    expect(normalizePixKey("11.222.333/0001-82")).toBeNull();
  });

  it("telefone brasileiro vira +55 e e-mail fica minúsculo", () => {
    expect(normalizePixKey("(11) 99999-0000")).toEqual({ type: "PHONE", key: "+5511999990000" });
    expect(normalizePixKey("+55 11 99999-0000")).toEqual({ type: "PHONE", key: "+5511999990000" });
    expect(normalizePixKey("  Tecnico@Exemplo.COM ")).toEqual({ type: "EMAIL", key: "tecnico@exemplo.com" });
    expect(normalizePixKey("+1 555 123 4567")).toBeNull();
    // 11 dígitos soltos: se não for CPF válido, não vira telefone em silêncio
    expect(normalizePixKey("11999990000")).toBeNull();
    expect(normalizePixKey("(11) 9999-000")).toBeNull();
  });

  it("chave aleatória (UUID) é aceita; lixo e vazio não", () => {
    expect(normalizePixKey("123E4567-E12B-12D1-A456-426655440000")).toEqual({ type: "RANDOM", key: "123e4567-e12b-12d1-a456-426655440000" });
    expect(normalizePixKey("")).toBeNull();
    expect(normalizePixKey("abc")).toBeNull();
    expect(normalizePixKey("123")).toBeNull();
  });
});
