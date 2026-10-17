import { describe, expect, it } from "vitest";
import { canSnooze, daysUntilExpiry, expiryLabel, followUpMessage, nudgedLabel, viewedLabel } from "@/lib/followup";
import { nudgeTemplateSchema } from "@/lib/validations/auth";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const now = new Date("2026-10-16T15:00:00Z");
const at = (ms: number) => new Date(now.getTime() + ms);

describe("followup", () => {
  it("dias até vencer: sem prazo = null, vencido = 0, arredonda para cima", () => {
    expect(daysUntilExpiry(null, now)).toBeNull();
    expect(daysUntilExpiry(at(-1), now)).toBe(0);
    expect(daysUntilExpiry(at(HOUR), now)).toBe(1);
    expect(daysUntilExpiry(at(DAY), now)).toBe(1);
    expect(daysUntilExpiry(at(DAY + 1), now)).toBe(2);
  });

  it("selo de vencimento só nas últimas 24h", () => {
    expect(expiryLabel(null, now)).toBeNull();
    expect(expiryLabel(at(2 * DAY), now)).toBeNull();
    expect(expiryLabel(at(DAY), now)).toBe("vence em até 24h");
    expect(expiryLabel(at(-HOUR), now)).toBe("vence hoje");
  });

  it("mensagem: padrão, modelo do técnico e urgência (que ignora o modelo)", () => {
    const base = { customerName: "Maria", number: 7, totalCents: 45000, publicId: "abc-123", viewedAt: now };
    const ctx = { template: null, tecnico: "Zé Frio", baseUrl: "https://fechouclima.com.br/" };
    const normal = followUpMessage({ ...base, validUntil: at(3 * DAY) }, now, ctx);
    expect(normal).toContain("Conseguiu ver o orçamento #7");
    expect(normal).toContain("https://fechouclima.com.br/o/abc-123");
    expect(followUpMessage({ ...base, validUntil: null }, now, ctx)).toContain("Conseguiu ver o orçamento #7");

    const custom = { ...ctx, template: "{cliente}, {valor} do #{numero}? Abs, {tecnico}. {link}" };
    expect(followUpMessage({ ...base, validUntil: at(3 * DAY) }, now, custom)).toMatch(/^Maria, R\$\s?450,00 do #7\? Abs, Zé Frio\. https:\/\/fechouclima\.com\.br\/o\/abc-123$/);

    const urgent = followUpMessage({ ...base, validUntil: at(HOUR) }, now, custom);
    expect(urgent).toContain("vence em breve");
    expect(urgent).toContain("/o/abc-123");
  });

  it("mensagem: variante por visto só vale sem modelo próprio; urgência vence tudo", () => {
    const base = { customerName: "Maria", number: 7, totalCents: 45000, publicId: "abc-123", validUntil: at(3 * DAY) };
    const ctx = { template: null, tecnico: "Zé Frio", baseUrl: "https://fechouclima.com.br/" };

    // sem modelo próprio: não visto usa a variante; visto usa o padrão
    expect(followUpMessage({ ...base, viewedAt: null }, now, ctx)).toContain("Conseguiu abrir o link?");
    expect(followUpMessage({ ...base, viewedAt: now }, now, ctx)).toContain("Conseguiu ver o orçamento #7");

    // modelo próprio vence a variante por visto, mesmo não visto
    const custom = { ...ctx, template: "Oi {cliente}, olha o #{numero}: {link}" };
    expect(followUpMessage({ ...base, viewedAt: null }, now, custom)).toContain("olha o #7");

    // urgência vence o modelo próprio e a variante por visto
    const urgent = followUpMessage({ ...base, viewedAt: null, validUntil: at(HOUR) }, now, custom);
    expect(urgent).toContain("vence em breve");
  });

  it("viewedLabel: só em SENT, visto ou não abriu o link", () => {
    expect(viewedLabel(null, "DRAFT")).toBeNull();
    expect(viewedLabel(now, "APPROVED")).toBeNull();
    expect(viewedLabel(null, "SENT")).toBe("não abriu o link");
    expect(viewedLabel(now, "SENT")).toBe("visto");
  });

  it("modelo de cobrança: 10 a 400 caracteres", () => {
    expect(nudgeTemplateSchema.safeParse({ template: "curto" }).success).toBe(false);
    expect(nudgeTemplateSchema.safeParse({ template: "Oi {cliente}, tudo bem?" }).success).toBe(true);
    expect(nudgeTemplateSchema.safeParse({ template: "x".repeat(401) }).success).toBe(false);
  });

  it("label de cobrança: hoje, há Xd e adiado (data futura + 48h)", () => {
    expect(nudgedLabel(null, now)).toBeNull();
    expect(nudgedLabel(at(-HOUR), now)).toBe("cobrado hoje");
    expect(nudgedLabel(at(-3 * DAY), now)).toBe("cobrado há 3d");
    // adiado em 16/10: lastNudgeAt = 17/10 15:00Z, volta 48h depois = 19/10
    expect(nudgedLabel(at(DAY), now)).toBe("adiado até 19/10");
  });

  it("canSnooze: só quando a validade passa da janela de 3 dias (ou não existe)", () => {
    const now = new Date("2026-10-17T12:00:00Z");
    const at = (ms: number) => new Date(now.getTime() + ms);
    const DAY = 86_400_000;
    expect(canSnooze(null, now)).toBe(true);
    expect(canSnooze(at(3 * DAY + 1000), now)).toBe(true);
    expect(canSnooze(at(3 * DAY), now)).toBe(false);
    expect(canSnooze(at(DAY), now)).toBe(false);
    expect(canSnooze(at(-DAY), now)).toBe(false);
  });
});
