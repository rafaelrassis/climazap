import { expect, test } from "@playwright/test";
import { login, newClientContext, prisma, seedTechnician } from "./helpers";

test.afterAll(async () => {
  await prisma.$disconnect();
});

// PNG 2x2 válido; o navegador converte para JPEG antes de enviar
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

test("fotos: técnico adiciona (JPEG reduzido no navegador), vê o limite de 4, cliente vê depois do envio e a remoção funciona", async ({ page, browser }) => {
  const t = await seedTechnician("photo", "DRAFT");
  await login(page, t.email);
  await page.goto(`/orcamentos/${t.quoteId}`);
  await page.waitForLoadState("networkidle");

  await expect(page.getByText("Fotos (0/4)")).toBeVisible();
  const input = page.locator('input[type="file"]');
  await input.setInputFiles({ name: "equipamento.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByText("Foto adicionada")).toBeVisible();
  await expect(page.getByText("Fotos (1/4)")).toBeVisible();
  await expect(page.getByAltText("Foto 1 do orçamento")).toBeVisible();

  // o arquivo guardado é JPEG (conversão feita no navegador)
  const stored = await prisma.quotePhoto.findFirstOrThrow({ where: { quoteId: t.quoteId } });
  expect(stored.type).toBe("image/jpeg");
  expect(stored.data.length).toBeLessThan(450 * 1024);
  expect(stored.data[0]).toBe(0xff);

  // enche até 4: o botão trava
  for (let i = 2; i <= 4; i++) {
    await input.setInputFiles({ name: `f${i}.png`, mimeType: "image/png", buffer: PNG });
    await expect(page.getByText(`Fotos (${i}/4)`)).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Limite de fotos atingido" })).toBeDisabled();

  // rascunho: o cliente ainda não vê as fotos
  const ctx = await newClientContext(browser);
  const client = await ctx.newPage();
  await client.goto(`/o/${t.publicId}`);
  await expect(client.getByAltText(/Foto \d do orçamento/)).toHaveCount(0);
  expect((await client.request.get(`/o/${t.publicId}/foto/${stored.id}`)).status()).toBe(404);

  // enviado: a galeria aparece na página pública
  await prisma.quote.update({ where: { id: t.quoteId }, data: { status: "SENT", sentAt: new Date() } });
  await client.reload();
  await expect(client.getByAltText(/Foto \d do orçamento/)).toHaveCount(4);
  const img = client.getByAltText("Foto 1 do orçamento");
  expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  expect((await client.request.get(`/o/${t.publicId}/foto/${stored.id}`)).headers()["content-type"]).toBe("image/jpeg");

  // remover uma foto
  await page.reload();
  await page.getByRole("button", { name: "Remover foto 4" }).click();
  await expect(page.getByText("Fotos (3/4)")).toBeVisible();
  await client.reload();
  await expect(client.getByAltText(/Foto \d do orçamento/)).toHaveCount(3);
  await ctx.close();
});

test("orçamento aprovado não permite mexer nas fotos e sem fotos não mostra o bloco", async ({ page }) => {
  const t = await seedTechnician("photo-appr", "APPROVED");
  await login(page, t.email);
  await page.goto(`/orcamentos/${t.quoteId}`);
  await expect(page.getByText(/Fotos \(/)).toHaveCount(0); // aprovado e sem fotos: nada a mostrar

  await prisma.quotePhoto.create({ data: { quoteId: t.quoteId, data: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), type: "image/jpeg" } });
  await page.reload();
  await expect(page.getByText("Fotos (1/4)")).toBeVisible();
  await expect(page.getByRole("button", { name: "Adicionar foto" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Remover foto/ })).toHaveCount(0);
});
