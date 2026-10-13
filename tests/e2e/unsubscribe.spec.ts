import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { prisma, seedTechnician } from "./helpers";

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("descadastro: GET só confirma, botão desativa, link inválido é recusado", async ({ page }) => {
  const t = await seedTechnician("unsub", "SENT");
  // mesmo HMAC do app, com o AUTH_SECRET do servidor de teste (playwright.config.ts)
  const token = createHmac("sha256", "e2e-secret").update(`digest:${t.userId}`).digest("hex");
  const link = `/descadastro?u=${t.userId}&t=${token}`;

  await page.goto(link);
  await expect(page.getByText("Deseja parar de receber o resumo semanal por e-mail?")).toBeVisible();
  // abrir o link não descadastra (scanners de e-mail fazem GET)
  expect((await prisma.user.findUniqueOrThrow({ where: { id: t.userId } })).emailDigest).toBe(true);

  await page.getByRole("button", { name: "Sim, cancelar o resumo" }).click();
  await expect(page.getByText(/Você não receberá mais o resumo semanal/)).toBeVisible();
  expect((await prisma.user.findUniqueOrThrow({ where: { id: t.userId } })).emailDigest).toBe(false);

  await page.goto(`/descadastro?u=${t.userId}&t=${"b".repeat(64)}`);
  await expect(page.getByText("Link inválido ou expirado.")).toBeVisible();
});
