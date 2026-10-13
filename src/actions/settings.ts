"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { MAX_LOGO_BYTES, detectLogoType } from "@/lib/logo";
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

export async function saveEmailDigest(enabled: boolean): Promise<ActionResult> {
  const userId = await requireUserId();
  await db.user.update({ where: { id: userId }, data: { emailDigest: enabled === true } });
  revalidatePath("/ajustes");
  return { ok: true, data: undefined };
}

// Logo do técnico: PNG até 150 KB (o cliente já reduz para 256px antes de enviar)
export async function saveLogo(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const file = formData.get("logo");
  if (!(file instanceof File)) return { ok: false, error: "Arquivo inválido" };
  if (file.size === 0 || file.size > MAX_LOGO_BYTES) return { ok: false, error: "A imagem deve ter até 150 KB" };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectLogoType(bytes);
  if (!type) return { ok: false, error: "Use uma imagem PNG" };

  await db.user.update({
    where: { id: userId },
    data: { logo: Buffer.from(bytes), logoType: type, logoUpdatedAt: new Date() },
  });
  revalidatePath("/ajustes");
  return { ok: true, data: undefined };
}

export async function removeLogo(): Promise<ActionResult> {
  const userId = await requireUserId();
  await db.user.update({ where: { id: userId }, data: { logo: null, logoType: null, logoUpdatedAt: null } });
  revalidatePath("/ajustes");
  return { ok: true, data: undefined };
}
