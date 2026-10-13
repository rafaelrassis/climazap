import { vi } from "vitest";

// Dependências do runtime do Next/Auth que não existem fora do servidor
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: () => new Headers({ "x-forwarded-for": "203.0.113.7" }) }));
vi.mock("@/lib/notify", () => ({ notifyQuoteResponse: vi.fn() }));

export const session = { userId: "" };
vi.mock("@/lib/session", () => ({
  requireUserId: async () => {
    if (!session.userId) throw new Error("UNAUTHORIZED");
    return session.userId;
  },
  getUserId: async () => session.userId || null,
}));
