import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

// Logo do técnico logado (pré-visualização em /ajustes). A versão pública é /o/[publicId]/logo.
export async function GET() {
  const userId = await getUserId();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const u = await db.user.findUnique({ where: { id: userId }, select: { logo: true, logoType: true } });
  if (!u?.logo || !u.logoType) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(u.logo), {
    headers: { "Content-Type": u.logoType, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" },
  });
}
