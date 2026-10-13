import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Foto de um orçamento já enviado, endereçada por publicId + id da foto. Rascunho não expõe fotos.
export async function GET(_req: Request, { params }: { params: Promise<{ publicId: string; photoId: string }> }) {
  const { publicId, photoId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(publicId) || !/^[a-z0-9]{20,30}$/i.test(photoId)) return new Response("Not found", { status: 404 });

  const photo = await db.quotePhoto.findFirst({
    where: { id: photoId, quote: { publicId, status: { not: "DRAFT" } } },
    select: { data: true, type: true },
  });
  if (!photo) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.type,
      "Content-Length": String(photo.data.length),
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
