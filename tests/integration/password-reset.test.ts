import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { requestPasswordReset, resetPassword } from "@/actions/auth";
import { hashToken } from "@/lib/password-reset";
import { resetDb } from "../helpers/db";

// evita carregar next-auth (depende do runtime do Next) fora do servidor
vi.mock("@/auth", () => ({ signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("next-auth", () => ({ AuthError: class AuthError extends Error {} }));

const emails: { to: string; subject: string; html: string; text: string }[] = [];
vi.mock("@/lib/email", async (orig) => ({
  ...(await orig<typeof import("@/lib/email")>()),
  sendEmail: async (m: { to: string; subject: string; html: string; text: string }) => {
    emails.push(m);
    return true;
  },
}));

const form = (o: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) fd.set(k, v);
  return fd;
};
const tokenFromEmail = (m: { text: string }) => m.text.match(/token=([0-9a-f]{64})/)![1];

async function userWithPassword(email: string, password = "senhaantiga") {
  return db.user.create({ data: { name: "Téc", email, passwordHash: await bcrypt.hash(password, 4) } });
}

beforeEach(async () => {
  await resetDb();
  emails.length = 0;
});

describe("pedido de recuperação", () => {
  it("responde igual para e-mail inexistente e não envia nada", async () => {
    expect(await requestPasswordReset(undefined, form({ email: "ninguem@t.com" }))).toEqual({ ok: true });
    expect(emails).toHaveLength(0);
    expect(await db.passwordResetToken.count()).toBe(0);
  });

  it("e-mail existente: guarda só o hash e envia o link com o token em claro", async () => {
    const u = await userWithPassword("a@t.com");
    expect(await requestPasswordReset(undefined, form({ email: "A@T.com " }))).toEqual({ ok: true }); // normaliza
    expect(emails).toHaveLength(1);
    expect(emails[0].to).toBe("a@t.com");
    expect(emails[0].html).toContain("redefinir-senha?token=");

    const token = tokenFromEmail(emails[0]);
    const row = await db.passwordResetToken.findFirstOrThrow({ where: { userId: u.id } });
    expect(row.tokenHash).toBe(hashToken(token));
    expect(row.tokenHash).not.toBe(token);
    expect(row.expiresAt.getTime() - Date.now()).toBeGreaterThan(59 * 60_000);
    expect(row.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(60 * 60_000);
  });

  it("um novo pedido invalida o link anterior", async () => {
    await userWithPassword("a@t.com");
    await requestPasswordReset(undefined, form({ email: "a@t.com" }));
    await requestPasswordReset(undefined, form({ email: "a@t.com" }));
    const [first, second] = emails.map(tokenFromEmail);
    expect(await db.passwordResetToken.count()).toBe(1);
    const old = await resetPassword(undefined, form({ token: first, password: "novasenha1", confirm: "novasenha1" }));
    expect(old.error).toMatch(/inválido ou expirado/);
    expect((await resetPassword(undefined, form({ token: second, password: "novasenha1", confirm: "novasenha1" }))).ok).toBe(true);
  });

  it("limita pedidos por e-mail (3/hora) e valida o formato", async () => {
    await userWithPassword("a@t.com");
    for (let i = 0; i < 3; i++) expect((await requestPasswordReset(undefined, form({ email: "a@t.com" }))).ok).toBe(true);
    expect((await requestPasswordReset(undefined, form({ email: "a@t.com" }))).error).toMatch(/Muitas tentativas/);
    expect((await requestPasswordReset(undefined, form({ email: "nao-e-email" }))).error).toBeTruthy();
  });
});

describe("redefinição", () => {
  async function pending(email = "a@t.com") {
    const u = await userWithPassword(email);
    await requestPasswordReset(undefined, form({ email }));
    return { u, token: tokenFromEmail(emails[emails.length - 1]) };
  }

  it("troca a senha, marca o token como usado e a senha antiga deixa de valer", async () => {
    const { u, token } = await pending();
    const res = await resetPassword(undefined, form({ token, password: "novasenha1", confirm: "novasenha1" }));
    expect(res.ok).toBe(true);
    const after = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(await bcrypt.compare("novasenha1", after.passwordHash)).toBe(true);
    expect(await bcrypt.compare("senhaantiga", after.passwordHash)).toBe(false);
    expect((await db.passwordResetToken.findUniqueOrThrow({ where: { tokenHash: hashToken(token) } })).usedAt).not.toBeNull();
  });

  it("uso único: reutilizar o mesmo link falha", async () => {
    const { token } = await pending();
    expect((await resetPassword(undefined, form({ token, password: "novasenha1", confirm: "novasenha1" }))).ok).toBe(true);
    expect((await resetPassword(undefined, form({ token, password: "outrasenha2", confirm: "outrasenha2" }))).error).toMatch(/inválido ou expirado/);
  });

  it("dois envios simultâneos do mesmo link: só um vence", async () => {
    const { u, token } = await pending();
    const results = await Promise.all([
      resetPassword(undefined, form({ token, password: "senhaA-123", confirm: "senhaA-123" })),
      resetPassword(undefined, form({ token, password: "senhaB-123", confirm: "senhaB-123" })),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const hash = (await db.user.findUniqueOrThrow({ where: { id: u.id } })).passwordHash;
    const winner = results[0].ok ? "senhaA-123" : "senhaB-123";
    expect(await bcrypt.compare(winner, hash)).toBe(true);
  });

  it("token expirado, malformado ou inexistente é recusado e nada muda", async () => {
    const { u, token } = await pending();
    await db.passwordResetToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await resetPassword(undefined, form({ token, password: "novasenha1", confirm: "novasenha1" }))).error).toMatch(/inválido ou expirado/);
    expect((await resetPassword(undefined, form({ token: "curto", password: "novasenha1", confirm: "novasenha1" }))).error).toBe("Link inválido");
    expect((await resetPassword(undefined, form({ token: "a".repeat(64), password: "novasenha1", confirm: "novasenha1" }))).error).toMatch(/inválido ou expirado/);
    const hash = (await db.user.findUniqueOrThrow({ where: { id: u.id } })).passwordHash;
    expect(await bcrypt.compare("senhaantiga", hash)).toBe(true);
  });

  it("senhas diferentes ou curtas não consomem o token", async () => {
    const { token } = await pending();
    expect((await resetPassword(undefined, form({ token, password: "novasenha1", confirm: "diferente1" }))).error).toBe("As senhas não conferem");
    expect((await resetPassword(undefined, form({ token, password: "123", confirm: "123" }))).error).toMatch(/Mínimo/);
    expect((await resetPassword(undefined, form({ token, password: "novasenha1", confirm: "novasenha1" }))).ok).toBe(true);
  });

  it("o token de um usuário não altera a senha de outro", async () => {
    const a = await pending("a@t.com");
    const b = await userWithPassword("b@t.com", "senhadob");
    await resetPassword(undefined, form({ token: a.token, password: "novasenha1", confirm: "novasenha1" }));
    expect(await bcrypt.compare("senhadob", (await db.user.findUniqueOrThrow({ where: { id: b.id } })).passwordHash)).toBe(true);
  });
});
