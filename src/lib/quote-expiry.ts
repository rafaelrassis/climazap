import { db } from "@/lib/db";

// Expiração na leitura: SENT vencidos -> EXPIRED (escopo do técnico logado)
export async function expireStaleQuotes(userId: string): Promise<void> {
  await db.quote.updateMany({
    where: { userId, status: "SENT", validUntil: { lt: new Date() } },
    data: { status: "EXPIRED" },
  });
}

// Todos os técnicos (cron diário); devolve quantos orçamentos expiraram
export async function expireAllStaleQuotes(): Promise<number> {
  const { count } = await db.quote.updateMany({
    where: { status: "SENT", validUntil: { lt: new Date() } },
    data: { status: "EXPIRED" },
  });
  return count;
}
