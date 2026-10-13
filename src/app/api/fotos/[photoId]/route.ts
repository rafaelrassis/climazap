import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

// Foto de um orçamento do técnico logado (miniaturas no detalhe, inclusive de rascunhos)
export async function GET(_req: Request, { params }: { params: Promise<{ photoId: string }> }) {
  const userId = await getUserId();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const { photoId } = await params;
  if (!/^[a-z0-9]{20,30}$/i.test(photoId)) return new Response("Not found", { status: 404 });

  const photo = await db.quotePhoto.findFirst({ where: { id: photoId, quote: { userId } }, select: { data: true, type: true } });
  if (!photo) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(photo.data), {
    headers: { "Content-Type": photo.type, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" },
  });
}
