import { ImageResponse } from "next/og";

export const BRAND_BG = "#0f172a";
export const BRAND_FG = "#7dd3fc";

// Ícone do app: "F" sobre fundo escuro. maskable = com margem de segurança (zona segura de 80%).
export function renderAppIcon(px: number, maskable = true) {
  const glyph = Math.round(px * (maskable ? 0.5 : 0.62));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BRAND_BG,
          color: BRAND_FG,
          fontSize: glyph,
          fontWeight: 800,
        }}
      >
        F
      </div>
    ),
    { width: px, height: px },
  );
}
