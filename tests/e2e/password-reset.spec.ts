import { createHash, randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { prisma, seedTechnician } from "./helpers";

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("esqueci a senha: pedido genérico, redefinição por link de uso único e novo login", async ({ page }) => {
  const t = await seedTechnician("reset", "SENT");

  // pedido: resposta igual para e-mail existente ou não
  await page.goto("/login");
  await page.getByRole("link", { name: "Esqueci minha senha" }).click();
  await page.waitForLoadState("networkidle"); // formulário hidratado antes de enviar
  await page.getByLabel("E-mail").fill("ninguem-aqui@fechouclima.com.br");
  await page.getByRole("button", { name: "Enviar link" }).click();
  await expect(page.getByText(/Se esse e-mail tiver conta/)).toBeVisible();

  // o e-mail real não existe no E2E: cria o token como o app faria (só o hash fica no banco)
  const token = randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: { userId: t.userId, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 3_600_000) },
  });

  await page.goto(`/redefinir-senha?token=${token}`);
  await page.getByLabel("Nova senha").fill("senha-nova-123");
  await page.getByLabel("Repita a senha").fill("senha-diferente");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(page.getByText("As senhas não conferem")).toBeVisible();

  await page.getByLabel("Nova senha").fill("senha-nova-123");
  await page.getByLabel("Repita a senha").fill("senha-nova-123");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(page.getByText("Senha alterada.")).toBeVisible();

  // o mesmo link não funciona de novo
  await page.goto(`/redefinir-senha?token=${token}`);
  await page.getByLabel("Nova senha").fill("outra-senha-456");
  await page.getByLabel("Repita a senha").fill("outra-senha-456");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(page.getByText(/Link inválido ou expirado/)).toBeVisible();

  // senha antiga não entra mais; a nova entra
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": "198.51.100.200" });
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(t.email);
  await page.getByLabel("Senha").fill("senha123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("E-mail ou senha inválidos")).toBeVisible();
  await expect(page.getByLabel("E-mail")).toHaveValue(t.email); // o e-mail digitado não some depois do erro
  await page.getByLabel("Senha").fill("senha-nova-123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/inicio$/);
});

test("tela de nova senha sem token válido mostra erro", async ({ page }) => {
  await page.goto("/redefinir-senha");
  await page.getByLabel("Nova senha").fill("qualquer-1");
  await page.getByLabel("Repita a senha").fill("qualquer-1");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(page.getByText("Link inválido")).toBeVisible();
});
