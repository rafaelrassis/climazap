import { z } from "zod";
import { MAINTENANCE_PLACEHOLDERS } from "@/lib/maintenance";

export const reminderMonthsSchema = z.union([z.literal(3), z.literal(6), z.literal(12)]).nullable();

// Até 300 caracteres; rejeita placeholder desconhecido (senão {xyz} iria literal para o cliente)
export const reminderTextSchema = z
  .string()
  .trim()
  .max(300, "Máximo de 300 caracteres")
  .nullable()
  .refine((v) => {
    if (!v) return true;
    const unknown = (v.match(/\{[^{}\s]*\}/g) ?? []).filter((p) => !(MAINTENANCE_PLACEHOLDERS as readonly string[]).includes(p));
    return unknown.length === 0;
  }, "Variável desconhecida no texto do lembrete");

export const createServiceSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(120),
  description: z.string().trim().max(500).optional(),
  unit: z.string().trim().min(1).max(10).default("un"),
  priceCents: z.number().int().nonnegative().max(100_000_00),
  reminderMonths: reminderMonthsSchema.optional(),
  reminderText: reminderTextSchema.optional(),
});

export type CreateServiceInput = z.input<typeof createServiceSchema>;

export const updateServiceSchema = createServiceSchema.extend({ id: z.string().min(1) });
export type UpdateServiceInput = z.input<typeof updateServiceSchema>;
