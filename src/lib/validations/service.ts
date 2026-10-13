import { z } from "zod";

export const createServiceSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(120),
  description: z.string().trim().max(500).optional(),
  unit: z.string().trim().min(1).max(10).default("un"),
  priceCents: z.number().int().nonnegative().max(100_000_00),
});

export type CreateServiceInput = z.input<typeof createServiceSchema>;
