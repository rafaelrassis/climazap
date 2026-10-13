"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { MAX_LOGO_BYTES, detectLogoType } from "@/lib/logo";
import { waTemplateSchema } from "@/lib/validations/auth";
import { pixSchema } from "@/lib/validations/pix";
import { pushSubscriptionSchema, type PushSubscriptionInput } from "@/lib/validations/push";
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

export async function savePushSubscription(input: PushSubscriptionInput, userAgent?: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = pushSubscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Assinatura inválida" };
  const { endpoint, keys } = parsed.data;

  // O endpoint é do navegador: se outro técnico entrar no mesmo aparelho, a assinatura passa a ser dele
  await db.pushSubscription.upsert({
    where: { endpoint },
    create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: userAgent?.slice(0, 200) ?? null },
    update: { userId, p256dh: keys.p256dh, auth: keys.auth, userAgent: userAgent?.slice(0, 200) ?? null },
  });
  revalidatePath("/ajustes");
  return { ok: true, data: undefined };
}

export async function removePushSubscription(endpoint: string): Promise<ActionResult> {
  const userId = await requireUserId();
  await db.pushSubscription.deleteMany({ where: { endpoint, userId } });
  revalidatePath("/ajustes");
  return { ok: true, data: undefined };
}

export async function savePix(key: string, city: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = pixSchema.safeParse({ key, city });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  await db.user.update({
    where: { id: userId },
    data: { pixKey: parsed.data.key, pixKeyType: parsed.data.type, pixCity: parsed.data.city },
  });
  revalidatePath("/ajustes");
  return { ok: true, data: undefined };
}

export async function removePix(): Promise<ActionResult> {
  const userId = await requireUserId();
  await db.user.update({ where: { id: userId }, data: { pixKey: null, pixKeyType: null, pixCity: null } });
  revalidatePath("/ajustes");
  return { ok: true, data: undefined };
}
