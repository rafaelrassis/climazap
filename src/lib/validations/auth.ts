import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(120),
  email: z.string().trim().toLowerCase().email("E-mail inválido").max(160),
  password: z.string().min(6, "Mínimo de 6 caracteres").max(72, "Máximo de 72 caracteres"),
});
