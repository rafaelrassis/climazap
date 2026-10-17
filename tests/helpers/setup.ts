import { vi } from "vitest";
import { db } from "@/lib/db";
import { isSessionRevoked } from "@/lib/session-revoked";

// Dependências do runtime do Next/Auth que não existem fora do servidor
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7" }) }));
vi.mock("@/lib/notify", () => ({ notifyQuoteResponse: vi.fn() }));

// issuedAt simula o momento em que o token JWT da sessão foi emitido (ver src/auth.config.ts).
// Junto com sessionsValidAfter no banco, reproduz a checagem real de requireUserId/getUserId.
export const session = { userId: "", issuedAt: Date.now() };

async function currentUserId(): Promise<string | null> {
  if (!session.userId) return null;
  const user = await db.user.findUnique({ where: { id: session.userId }, select: { sessionsValidAfter: true } });
  if (!user || isSessionRevoked(session.issuedAt, user.sessionsValidAfter)) return null;
  return session.userId;
}

vi.mock("@/lib/session", () => ({
  requireUserId: async () => {
    const id = await currentUserId();
    if (!id) throw new Error("UNAUTHORIZED");
    return id;
  },
  getUserId: async () => currentUserId(),
}));
