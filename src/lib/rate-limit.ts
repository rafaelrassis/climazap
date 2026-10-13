import { headers } from "next/headers";
import { db } from "@/lib/db";

export async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

// Janela fixa atômica (um único upsert). Retorna ok=false quando passou do limite.
export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number,
): Promise<{ ok: boolean; retryAfterSec: number }> {
  const rows = await db.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, now() + (${windowSec} * interval '1 second'))
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN "RateLimit"."resetAt" <= now() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" <= now() THEN now() + (${windowSec} * interval '1 second') ELSE "RateLimit"."resetAt" END
    RETURNING "count", "resetAt"`;
  const { count, resetAt } = rows[0];

  if (Math.random() < 0.01) {
    void db.rateLimit.deleteMany({ where: { resetAt: { lt: new Date() } } }).catch(() => {});
  }

  return { ok: count <= limit, retryAfterSec: Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000)) };
}

// Leitura sem consumir (para escolher a mensagem de erro e o tempo de espera)
export async function rateLimitInfo(
  key: string,
  limit: number,
): Promise<{ limited: boolean; retryAfterSec: number }> {
  const row = await db.rateLimit.findUnique({ where: { key } });
  const active = !!row && row.resetAt > new Date();
  return {
    limited: active && row!.count > limit,
    retryAfterSec: active ? Math.max(1, Math.ceil((row!.resetAt.getTime() - Date.now()) / 1000)) : 0,
  };
}

export async function isRateLimited(key: string, limit: number): Promise<boolean> {
  return (await rateLimitInfo(key, limit)).limited;
}

export const LIMITS = {
  loginEmail: { limit: 8, windowSec: 15 * 60 },
  loginIp: { limit: 30, windowSec: 15 * 60 },
  register: { limit: 15, windowSec: 60 * 60 },
  resetIp: { limit: 10, windowSec: 60 * 60 },
  resetEmail: { limit: 3, windowSec: 60 * 60 },
  resetUse: { limit: 15, windowSec: 60 * 60 },
  publicAction: { limit: 20, windowSec: 10 * 60 },
} as const;
