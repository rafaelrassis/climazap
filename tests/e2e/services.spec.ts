import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { registerTechnician } from "./helpers";

const db = new PrismaClient({
  datasources: {
    db: { url: process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/climazap_test" },
  },
});

test.beforeAll(async () => {
  await db.service.create({
    data: { userId: null, name: "Limpeza padrão", unit: "un", priceCents: 18000, description: "Serviço do sistema" },
  });
});
test.afterAll(async () => {
  await db.$disconnect();
});

const card = (page: import("@playwright/test").Page, name: string) =>
  page.locator(".space-y-2.p-3", { hasText: name });

test("serviços: criar, personalizar preço de padrão sem alterá-lo, ocultar e restaurar", async ({ page }) => {
  await registerTechnician(page, "svc");
  await page.goto("/servicos");

  // criar serviço próprio
  await page.getByRole("button", { name: "Novo" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Instalação de cortina de ar");
  await page.getByLabel("Preço", { exact: true }).fill("35000");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(card(page, "Instalação de cortina de ar")).toBeVisible();
  await expect(card(page, "Instalação de cortina de ar").getByText("R$ 350,00")).toBeVisible();
  await expect(card(page, "Instalação de cortina de ar").getByText("Meu serviço")).toBeVisible();

  // personalizar preço do padrão
  await expect(card(page, "Limpeza padrão").getByText("R$ 180,00")).toBeVisible();
  await card(page, "Limpeza padrão").getByRole("button", { name: "Editar" }).click();
  await expect(page.getByLabel("Nome", { exact: true })).toBeDisabled(); // padrão: só o preço muda
  await page.getByLabel("Preço", { exact: true }).fill("20000");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(card(page, "Limpeza padrão").getByText("R$ 200,00")).toBeVisible();
  await expect(card(page, "Limpeza padrão").getByText("Preço personalizado")).toBeVisible();

  // o padrão do sistema continua intacto no banco
  const base = await db.service.findFirstOrThrow({ where: { userId: null, name: "Limpeza padrão" } });
  expect(base.priceCents).toBe(18000);

  // voltar ao padrão
  await card(page, "Limpeza padrão").getByRole("button", { name: "Voltar ao padrão" }).click();
  await expect(card(page, "Limpeza padrão").getByText("R$ 180,00")).toBeVisible();
  await expect(card(page, "Limpeza padrão").getByText("Preço personalizado")).toHaveCount(0);

  // ocultar e restaurar
  await card(page, "Limpeza padrão").getByRole("button", { name: "Remover" }).click();
  await expect(card(page, "Limpeza padrão")).toHaveCount(0);
  await expect(page.getByText("Padrões ocultos")).toBeVisible();
  await page.getByRole("button", { name: "Restaurar" }).click();
  await expect(card(page, "Limpeza padrão")).toBeVisible();
});

test("serviços de um técnico não aparecem para outro", async ({ page, browser }) => {
  await registerTechnician(page, "a");
  await page.goto("/servicos");
  await page.getByRole("button", { name: "Novo" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Serviço secreto do A");
  await page.getByLabel("Preço", { exact: true }).fill("1000");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(card(page, "Serviço secreto do A")).toBeVisible();

  const ctx = await browser.newContext();
  const other = await ctx.newPage();
  await registerTechnician(other, "b");
  await other.goto("/servicos");
  await expect(other.getByRole("heading", { name: "Serviços" })).toBeVisible();
  await expect(other.getByText("Serviço secreto do A")).toHaveCount(0);
  await ctx.close();
});
