import { expect, test } from "@playwright/test";
import { login, newClientContext, prisma, seedTechnician } from "./helpers";

test.afterAll(async () => {
  await prisma.$disconnect();
});

const DAY = 86_400_000;

test("cliente aprova um orçamento com serviço de 6 meses e o técnico vê o aviso agendado", async ({ page, browser }) => {
  const svc = await prisma.service.create({
    data: { userId: null, name: "Limpeza de teste", unit: "un", priceCents: 18000, reminderMonths: 6 },
  });
  const t = await seedTechnician("lemb", "SENT", {
    items: { create: [{ description: svc.name, unit: svc.unit, quantity: 1, unitPriceCents: svc.priceCents, totalCents: svc.priceCents, serviceId: svc.id }] },
  });

  const ctx = await newClientContext(browser);
  const client = await ctx.newPage();
  await client.goto(`/o/${t.publicId}`);
  await client.getByRole("button", { name: "Aprovar orçamento" }).click();
  await client.getByRole("button", { name: "Sim, aprovar" }).click();
  await expect(client.getByText(/Aprovado.*Obrigado/)).toBeVisible();
  await ctx.close();

  await login(page, t.email);
  await page.goto(`/orcamentos/${t.quoteId}`);
  await expect(page.getByText(/^Aviso em /)).toBeVisible();
  await expect(page.getByText(`Origem: serviço ${svc.name}`)).toBeVisible();

  const row = await prisma.quote.findUniqueOrThrow({ where: { id: t.quoteId } });
  expect(row.reminderService).toBe(svc.name);
  expect(row.reminderAt).not.toBeNull();
});

test("painel: Chamar usa a mensagem com o serviço; Feito agenda a próxima manutenção e o card some", async ({ page }) => {
  const t = await seedTechnician("lemb2", "APPROVED", {
    respondedAt: new Date(Date.now() - 7 * DAY),
    reminderAt: new Date(Date.now() - DAY), // vencido: aparece em "Hora da manutenção"
    reminderText: "Oi {cliente}! {tecnico} aqui, hora de cuidar de ({servico}).",
    reminderService: "Limpeza de teste",
  });

  await login(page, t.email);
  await page.goto("/inicio");
  await expect(page.getByRole("heading", { name: "Hora da manutenção" })).toBeVisible();
  const card = page
    .locator("section", { has: page.getByRole("heading", { name: "Hora da manutenção" }) })
    .locator("> div")
    .filter({ hasText: t.customerName });

  const href = await card.getByRole("link", { name: "Chamar" }).getAttribute("href");
  const text = new URL(href!).searchParams.get("text") ?? "";
  expect(text).toContain(`hora de cuidar de (Limpeza de teste)`);
  expect(text).toContain(t.customerName);

  // 360px: sem rolagem horizontal e botão Chamar com >= 44px de altura
  await page.setViewportSize({ width: 360, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const box = await card.getByRole("link", { name: "Chamar" }).boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

  await card.getByRole("button", { name: "Feito" }).click();
  await page.getByRole("button", { name: "6 meses" }).click();
  await expect(page.getByText("Próxima manutenção em 6 meses")).toBeVisible();
  await expect(card).toHaveCount(0);

  const row = await prisma.quote.findUniqueOrThrow({ where: { id: t.quoteId } });
  expect(row.reminderDoneAt).toBeNull();
  const expected = new Date();
  expected.setMonth(expected.getMonth() + 6);
  expect(Math.abs(row.reminderAt!.getTime() - expected.getTime())).toBeLessThan(5 * 60_000);
});
