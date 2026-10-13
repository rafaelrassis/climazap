// Paleta fixa: todas têm contraste >= 4.5:1 com texto branco (testado), então qualquer escolha fica legível
export const BRAND_COLORS = [
  { name: "Azul-marinho", hex: "#0f172a" },
  { name: "Azul", hex: "#1d4ed8" },
  { name: "Ciano", hex: "#0e7490" },
  { name: "Verde", hex: "#0b6e4f" },
  { name: "Laranja", hex: "#c2410c" },
  { name: "Vermelho", hex: "#be123c" },
  { name: "Roxo", hex: "#7c3aed" },
  { name: "Grafite", hex: "#374151" },
] as const;

export const DEFAULT_BRAND = BRAND_COLORS[0].hex;

export const isBrandColor = (v: unknown): v is (typeof BRAND_COLORS)[number]["hex"] =>
  typeof v === "string" && BRAND_COLORS.some((c) => c.hex === v);

export const brandOrDefault = (v: string | null | undefined): string => (isBrandColor(v) ? v : DEFAULT_BRAND);

// Razão de contraste WCAG entre duas cores #rrggbb
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
