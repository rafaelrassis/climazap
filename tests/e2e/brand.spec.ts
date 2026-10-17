import { expect, test } from "@playwright/test";
import { login, newClientContext, prisma, seedTechnician } from "./helpers";

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("cor da marca: escolhida em Ajustes, aplicada no botão de aprovar, no nome e na OG image", async ({ page, browser }) => {
  const t = await seedTechnician("brand", "SENT");
  await login(page, t.email);
  await page.goto("/ajustes");
  await page.waitForLoadState("networkidle");

  const radios = page.getByRole("radiogroup", { name: "Cor da marca" }).getByRole("radio");
  await expect(radios).toHaveCount(8);
  await expect(page.getByRole("radio", { name: "Azul-marinho" })).toHaveAttribute("aria-checked", "true"); // padrão
  await page.getByRole("radio", { name: "Verde" }).click();
  await expect(page.getByText("Cor salva")).toBeVisible();
  await expect(page.getByRole("radio", { name: "Verde" })).toHaveAttribute("aria-checked", "true");
  await page.reload();
  await expect(page.getByRole("radio", { name: "Verde" })).toHaveAttribute("aria-checked", "true");
  expect((await prisma.user.findUniqueOrThrow({ where: { id: t.userId } })).brandColor).toBe("#0b6e4f");

  const ctx = await newClientContext(browser);
  const client = await ctx.newPage();
  await client.goto(`/o/${t.publicId}`);
  const approve = client.getByRole("button", { name: "Aprovar orçamento" });
  expect(await approve.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(11, 110, 79)");
  expect(await approve.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(255, 255, 255)");

  const og = await client.request.get(`/o/${t.publicId}/opengraph-image`);
  expect(og.status()).toBe(200);
  expect(og.headers()["content-type"]).toBe("image/png");
  const pdf = await client.request.get(`/o/${t.publicId}/pdf`);
  expect(pdf.status()).toBe(200);
  await ctx.close();

  // valor fora da paleta no banco (corrompido/legado) cai no padrão, sem quebrar a página
  await prisma.user.update({ where: { id: t.userId }, data: { brandColor: "red;background:url(x)" } });
  const ctx2 = await newClientContext(browser);
  const c2 = await ctx2.newPage();
  await c2.goto(`/o/${t.publicId}`);
  expect(await c2.getByRole("button", { name: "Aprovar orçamento" }).evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(15, 23, 42)");
  await ctx2.close();
});
