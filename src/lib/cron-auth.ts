import { timingSafeEqual } from "node:crypto";

// Cron da Vercel envia Authorization: Bearer $CRON_SECRET. Sem segredo configurado, recusa tudo.
export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
