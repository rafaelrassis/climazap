import { renderAppIcon } from "@/lib/app-icon";

const SIZES = new Set([192, 512]);

export function GET(_req: Request, { params }: { params: { size: string } }) {
  const px = Number(params.size);
  if (!SIZES.has(px)) return new Response("Not found", { status: 404 });
  return renderAppIcon(px);
}
