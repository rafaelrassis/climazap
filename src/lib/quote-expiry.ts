import { db } from "@/lib/db";

// Expiração na leitura: SENT vencidos -> EXPIRED (escopo do técnico logado)
export async function expireStaleQuotes(userId: string): Promise<void> {
  await db.quote.updateMany({
    where: { userId, status: "SENT", validUntil: { lt: new Date() } },
    data: { status: "EXPIRED" },
  });
}
