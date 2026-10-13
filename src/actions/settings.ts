"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { waTemplateSchema } from "@/lib/validations/auth";
import type { ActionResult } from "@/types/action";

export async function saveWaTemplate(template: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = waTemplateSchema.safeParse({ template });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Mensagem inválida" };
  }
  await db.user.update({ where: { id: userId }, data: { waTemplate: parsed.data.template } });
  revalidatePath("/ajustes");
  return { ok: true, data: undefined };
}

// Volta ao modelo padrão
export async function resetWaTemplate(): Promise<ActionResult> {
  const userId = await requireUserId();
  await db.user.update({ where: { id: userId }, data: { waTemplate: null } });
  revalidatePath("/ajustes");
  return { ok: true, data: undefined };
}
