import { describe, expect, it } from "vitest";
import { BRAND_COLORS, brandOrDefault, contrast, DEFAULT_BRAND, isBrandColor } from "@/lib/brand";

describe("cor da marca", () => {
  it("toda cor da paleta tem contraste mínimo de 4.5:1 com texto branco (WCAG AA)", () => {
    for (const c of BRAND_COLORS) expect(contrast(c.hex, "#ffffff"), `${c.name} ${c.hex}`).toBeGreaterThanOrEqual(4.5);
  });

  it("contraste: referências conhecidas", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrast("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });

  it("só aceita cores da paleta; qualquer outra volta ao padrão (nunca vai CSS arbitrário para a página)", () => {
    expect(isBrandColor("#1d4ed8")).toBe(true);
    for (const bad of ["#ffff00", "red", "javascript:alert(1)", "#1d4ed8;background:url(x)", "", null, undefined, 123]) {
      expect(isBrandColor(bad)).toBe(false);
      expect(brandOrDefault(bad as never)).toBe(DEFAULT_BRAND);
    }
    expect(brandOrDefault("#0b6e4f")).toBe("#0b6e4f");
  });

  it("paleta sem cores repetidas", () => {
    expect(new Set(BRAND_COLORS.map((c) => c.hex)).size).toBe(BRAND_COLORS.length);
  });
});
