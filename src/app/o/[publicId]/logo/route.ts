import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Logo do técnico dono do orçamento, endereçada pelo publicId (nunca pelo ID interno do usuário)
export async function GET(_req: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(publicId)) return new Response("Not found", { status: 404 });

  const q = await db.quote.findUnique({
    where: { publicId },
    select: { user: { select: { logo: true, logoType: true } } },
  });
  const { logo, logoType } = q?.user ?? {};
  if (!logo || !logoType) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(logo), {
    headers: {
      "Content-Type": logoType,
      "Content-Length": String(logo.length),
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
