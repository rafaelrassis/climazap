import { z } from "zod";

export const updateCustomerSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2, "Nome muito curto").max(120),
  address: z.string().trim().max(300).optional(),
});

export type UpdateCustomerInput = z.input<typeof updateCustomerSchema>;
