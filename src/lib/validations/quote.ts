import { z } from "zod";

export const quoteItemSchema = z
  .object({
    serviceId: z.string().min(1).optional(),
    description: z.string().trim().min(2).max(200).optional(),
    unit: z.string().trim().min(1).max(10).optional(),
    quantity: z.number().positive().max(9999),
    unitPriceCents: z.number().int().nonnegative().max(100_000_00).optional(),
  })
  .refine((i) => i.serviceId || (i.description && i.unitPriceCents !== undefined), {
    message: "Informe um serviço ou descrição + preço",
  });

export const createQuoteSchema = z.object({
  customerName: z.string().trim().min(2).max(120),
  customerPhone: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .pipe(z.string().min(10, "Telefone inválido").max(13, "Telefone inválido")),
  customerAddress: z.string().trim().max(300).optional(),
  title: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
  discountCents: z.number().int().nonnegative().default(0),
  validDays: z.number().int().min(1).max(90).default(7),
  items: z.array(quoteItemSchema).min(1, "Adicione ao menos 1 item").max(50),
});

export type CreateQuoteInput = z.input<typeof createQuoteSchema>;
