import { z } from "zod";

// Formato de PushSubscription.toJSON() do navegador
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2048).startsWith("https://"),
  keys: z.object({
    p256dh: z.string().min(10).max(256),
    auth: z.string().min(10).max(256),
  }),
});

export type PushSubscriptionInput = z.input<typeof pushSubscriptionSchema>;
