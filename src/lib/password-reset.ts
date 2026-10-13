import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";

export const RESET_TTL_MS = 60 * 60 * 1000; // 1 hora

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

// Gera um token novo (o anterior ainda não usado deixa de valer) e devolve o valor em claro, que só vai por e-mail
export async function createResetToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await db.$transaction([
    db.passwordResetToken.deleteMany({ where: { userId, usedAt: null } }),
    db.passwordResetToken.create({
      data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) },
    }),
  ]);
  return token;
}

export function resetUrl(token: string, base: string) {
  return `${base.replace(/\/$/, "")}/redefinir-senha?token=${token}`;
}
