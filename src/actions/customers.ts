"use server";

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";

// Clientes recentes do técnico para o autocomplete do formulário
export async function listCustomers() {
  const userId = await requireUserId();
  return db.customer.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: { id: true, name: true, phone: true, address: true },
  });
}
