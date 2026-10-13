import { createHmac, timingSafeEqual } from "node:crypto";

// Link de descadastro assinado (HMAC com AUTH_SECRET): permite sair do resumo sem login
function sign(userId: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET ausente");
  return createHmac("sha256", secret).update(`digest:${userId}`).digest("hex");
}

export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  if (!userId || !/^[0-9a-f]{64}$/.test(token)) return false;
  const a = Buffer.from(sign(userId));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function unsubscribeUrl(userId: string, base: string): string {
  const qs = new URLSearchParams({ u: userId, t: sign(userId) });
  return `${base.replace(/\/$/, "")}/descadastro?${qs}`;
}

export function unsubscribePostUrl(userId: string, base: string): string {
  const qs = new URLSearchParams({ u: userId, t: sign(userId) });
  return `${base.replace(/\/$/, "")}/api/descadastro?${qs}`;
}
