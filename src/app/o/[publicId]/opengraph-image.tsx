import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/money";

export const alt = "Orçamento FechouClima";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 300;

// Prévia do link no WhatsApp. Só dados já públicos na página: sem telefone/endereço/IDs internos.
export default async function OgImage({ params }: { params: { publicId: string } }) {
  const q = /^[0-9a-f-]{36}$/i.test(params.publicId)
    ? await db.quote.findUnique({
        where: { publicId: params.publicId },
        select: {
          number: true,
          customerName: true,
          totalCents: true,
          user: { select: { name: true, companyName: true } },
        },
      })
    : null;

  const sender = q ? (q.user.companyName ?? q.user.name) : "FechouClima";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0f172a",
          color: "#ffffff",
          padding: 72,
        }}
      >
        <div style={{ display: "flex", fontSize: 40, color: "#7dd3fc" }}>{sender}</div>
        {q ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 56, color: "#cbd5e1" }}>
              {`Orçamento #${q.number} para ${q.customerName}`.slice(0, 60)}
            </div>
            <div style={{ display: "flex", fontSize: 136, fontWeight: 700, marginTop: 16 }}>
              {formatBRL(q.totalCents)}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", fontSize: 72 }}>Orçamento não encontrado</div>
        )}
        <div style={{ display: "flex", fontSize: 36, color: "#94a3b8" }}>Toque no link para ver e aprovar</div>
      </div>
    ),
    size,
  );
}
