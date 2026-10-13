"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { createServiceSchema, type CreateServiceInput } from "@/lib/validations/service";
import type { ActionResult } from "@/types/action";

export async function listServices() {
  const userId = await requireUserId();
  return db.service.findMany({
    where: { isActive: true, OR: [{ userId: null }, { userId }] },
    orderBy: [{ userId: "asc" }, { name: "asc" }],
    select: { id: true, name: true, description: true, unit: true, priceCents: true, userId: true },
  });
}

export async function createService(input: CreateServiceInput): Promise<ActionResult<{ id: string }>> {
  const userId = await requireUserId();
  const parsed = createServiceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Dados inválidos", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const service = await db.service.create({
    data: { ...parsed.data, userId },
    select: { id: true },
  });

  revalidatePath("/servicos");
  return { ok: true, data: service };
}
