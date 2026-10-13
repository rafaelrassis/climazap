"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { updateCustomerSchema, type UpdateCustomerInput } from "@/lib/validations/customer";
import type { ActionResult } from "@/types/action";

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

export async function updateCustomer(input: UpdateCustomerInput): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = updateCustomerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const { id, name, address } = parsed.data;

  const { count } = await db.customer.updateMany({
    where: { id, userId },
    data: { name, address: address || null },
  });
  if (count === 0) return { ok: false, error: "Cliente não encontrado" };

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  return { ok: true, data: undefined };
}

// Orçamentos do cliente continuam existindo (snapshot de nome/telefone); só o vínculo é desfeito
export async function deleteCustomer(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const { count } = await db.customer.deleteMany({ where: { id, userId } });
  if (count === 0) return { ok: false, error: "Cliente não encontrado" };

  revalidatePath("/clientes");
  return { ok: true, data: undefined };
}
