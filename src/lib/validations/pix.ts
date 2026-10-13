import { z } from "zod";
import { normalizePixKey, pixText } from "@/lib/pix";

export const pixSchema = z
  .object({
    key: z.string().trim().min(1, "Informe a chave Pix").max(120),
    city: z.string().trim().min(2, "Informe a cidade").max(60),
  })
  .transform((v, ctx) => {
    const norm = normalizePixKey(v.key);
    if (!norm) {
      ctx.addIssue({
        code: "custom",
        path: ["key"],
        message: "Chave inválida. Use CPF/CNPJ válido, e-mail, chave aleatória ou telefone como +55 11 99999-0000 ou (11) 99999-0000",
      });
      return z.NEVER;
    }
    const city = pixText(v.city, 15);
    if (!city) {
      ctx.addIssue({ code: "custom", path: ["city"], message: "Cidade inválida" });
      return z.NEVER;
    }
    return { key: norm.key, type: norm.type, city };
  });
