import { db } from "@/lib/db";
import { session } from "./setup";

export async function resetDb() {
  await db.$executeRawUnsafe(
    'TRUNCATE "RateLimit", "PasswordResetToken", "PushSubscription", "QuoteItem", "Quote", "Customer", "Service", "User" RESTART IDENTITY CASCADE',
  );
  session.userId = "";
}

export async function makeUser(email = `u${Math.random().toString(36).slice(2)}@t.com`) {
  return db.user.create({ data: { name: "Técnico", email, passwordHash: "x" } });
}

export const loginAs = (userId: string) => {
  session.userId = userId;
};

export async function makeSystemService(name = "Instalação", priceCents = 45000) {
  return db.service.create({ data: { userId: null, name, unit: "un", priceCents } });
}

export const quoteInput = (over: Record<string, unknown> = {}) => ({
  customerName: "Maria",
  customerPhone: "(11) 99999-0000",
  validDays: 7,
  discountCents: 0,
  items: [{ description: "Limpeza", unit: "un", quantity: 2, unitPriceCents: 10000 }],
  ...over,
});
