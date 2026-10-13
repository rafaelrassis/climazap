import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { brandOrDefault } from "@/lib/brand";
import { pngSize } from "@/lib/logo";
import { formatBRL } from "@/lib/money";

export const alt = "Orçamento FechouClima";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 300;

// Prévia do link no WhatsApp. Só dados já públicos na página: sem telefone/endereço/IDs internos.
export default async function OgImage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const q = /^[0-9a-f-]{36}$/i.test(publicId)
    ? await db.quote.findUnique({
        where: { publicId },
        select: {
          number: true,
          customerName: true,
          totalCents: true,
          user: { select: { name: true, companyName: true, logo: true, logoType: true, brandColor: true } },
        },
      })
    : null;

  const brand = brandOrDefault(q?.user.brandColor);
  const sender = q ? (q.user.companyName ?? q.user.name) : "FechouClima";
  const dims = q?.user.logo ? pngSize(q.user.logo) : null;
  const LOGO_H = 96;
  const logoSrc =
    q?.user.logo && q.user.logoType && dims
      ? `data:${q.user.logoType};base64,${Buffer.from(q.user.logo).toString("base64")}`
      : null;
  const logoW = dims ? Math.min(Math.round((LOGO_H * dims.width) / dims.height), 360) : 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: brand,
          color: "#ffffff",
          padding: 72,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24, fontSize: 40, color: "#ffffff" }}>
          {logoSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoSrc} alt="" width={logoW} height={LOGO_H} style={{ width: logoW, height: LOGO_H, objectFit: "contain", borderRadius: 12, background: "#ffffff" }} />
          )}
          {sender}
        </div>
        {q ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 56, color: "#f1f5f9" }}>
              {`Orçamento #${q.number} para ${q.customerName}`.slice(0, 60)}
            </div>
            <div style={{ display: "flex", fontSize: 136, fontWeight: 700, marginTop: 16 }}>
              {formatBRL(q.totalCents)}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", fontSize: 72 }}>Orçamento não encontrado</div>
        )}
        <div style={{ display: "flex", fontSize: 36, color: "#e2e8f0" }}>Toque no link para ver e aprovar</div>
      </div>
    ),
    size,
  );
}
