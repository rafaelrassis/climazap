"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import {
  createServiceSchema,
  updateServiceSchema,
  type CreateServiceInput,
  type UpdateServiceInput,
} from "@/lib/validations/service";
import type { ActionResult } from "@/types/action";

const SELECT = {
  id: true,
  name: true,
  description: true,
  unit: true,
  priceCents: true,
  userId: true,
  overridesId: true,
  reminderMonths: true,
  reminderText: true,
} as const;

// Serviços ativos do técnico + padrões do sistema que ele não personalizou nem ocultou
export async function listServices() {
  const userId = await requireUserId();
  const mine = await db.service.findMany({
    where: { userId },
    select: { overridesId: true },
  });
  const replaced = mine.map((m) => m.overridesId).filter((v): v is string => !!v);

  return db.service.findMany({
    where: {
      isActive: true,
      OR: [{ userId }, { userId: null, id: { notIn: replaced } }],
    },
    orderBy: [{ userId: "asc" }, { name: "asc" }],
    select: SELECT,
  });
}

// Padrões ocultos pelo técnico (para restaurar)
export async function listHiddenDefaults() {
  const userId = await requireUserId();
  return db.service.findMany({
    where: { userId, isActive: false, overridesId: { not: null } },
    orderBy: { name: "asc" },
    select: SELECT,
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

// Serviço próprio: edita tudo. Serviço padrão: cria/atualiza uma cópia do técnico (só o preço muda).
export async function updateService(input: UpdateServiceInput): Promise<ActionResult<{ id: string }>> {
  const userId = await requireUserId();
  const parsed = updateServiceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Dados inválidos", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { id, ...data } = parsed.data;

  const own = await db.service.findFirst({ where: { id, userId }, select: { id: true } });
  if (own) {
    await db.service.update({ where: { id: own.id }, data });
    revalidatePath("/servicos");
    return { ok: true, data: { id: own.id } };
  }

  const base = await db.service.findFirst({ where: { id, userId: null, isActive: true } });
  if (!base) return { ok: false, error: "Serviço não encontrado" };

  const override = await db.service.upsert({
    where: { userId_overridesId: { userId, overridesId: base.id } },
    create: {
      userId,
      overridesId: base.id,
      name: base.name,
      description: base.description,
      unit: base.unit,
      priceCents: data.priceCents,
      reminderMonths: base.reminderMonths,
      reminderText: base.reminderText,
    },
    update: { priceCents: data.priceCents, isActive: true },
    select: { id: true },
  });

  revalidatePath("/servicos");
  return { ok: true, data: override };
}

// Próprio: desativa. Padrão: oculta só para o técnico (cópia inativa). Orçamentos antigos não mudam (snapshot).
export async function removeService(id: string): Promise<ActionResult> {
  const userId = await requireUserId();

  const { count } = await db.service.updateMany({ where: { id, userId }, data: { isActive: false } });
  if (count === 0) {
    const base = await db.service.findFirst({ where: { id, userId: null } });
    if (!base) return { ok: false, error: "Serviço não encontrado" };
    await db.service.upsert({
      where: { userId_overridesId: { userId, overridesId: base.id } },
      create: {
        userId,
        overridesId: base.id,
        name: base.name,
        description: base.description,
        unit: base.unit,
        priceCents: base.priceCents,
        reminderMonths: base.reminderMonths,
        reminderText: base.reminderText,
        isActive: false,
      },
      update: { isActive: false },
    });
  }

  revalidatePath("/servicos");
  return { ok: true, data: undefined };
}

// Volta ao serviço padrão do sistema (apaga a personalização/ocultação)
export async function restoreDefaultService(baseId: string): Promise<ActionResult> {
  const userId = await requireUserId();
  await db.service.deleteMany({ where: { userId, overridesId: baseId } });
  revalidatePath("/servicos");
  return { ok: true, data: undefined };
}
