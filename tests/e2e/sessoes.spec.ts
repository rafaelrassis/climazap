import { expect, test } from "@playwright/test";
import { login, prisma, seedTechnician } from "./helpers";

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("sair de todos os aparelhos derruba a sessão do outro aparelho", async ({ browser }) => {
  const t = await seedTechnician("sessoes", "DRAFT");

  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  await login(pageA, t.email);

  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await login(pageB, t.email);

  // B ainda está logado antes do A sair de todos os aparelhos
  await pageB.goto("/orcamentos");
  await expect(pageB).not.toHaveURL(/\/login/);

  await pageA.goto("/ajustes");
  await pageA.getByRole("button", { name: "Sair de todos os aparelhos" }).click();
  await pageA.getByRole("button", { name: "Sim, sair de todos" }).click();
  await pageA.waitForURL(/\/login/);

  // B navega de novo (mesmo cookie de sempre) e é mandado para /login
  await pageB.goto("/orcamentos");
  await expect(pageB).toHaveURL(/\/login/);

  await ctxA.close();
  await ctxB.close();
});
