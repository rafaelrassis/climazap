import { expect, test } from "@playwright/test";
import { prisma, seedTechnician, uniqueIp } from "./helpers";

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("página pública oferece o PDF só depois de enviado; o arquivo é um PDF válido", async ({ page }) => {
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": uniqueIp() });
  const sent = await seedTechnician("pdf-sent", "SENT");
  await page.goto(`/o/${sent.publicId}`);
  const link = page.getByRole("link", { name: "Baixar PDF" });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", `/o/${sent.publicId}/pdf`);

  const res = await page.request.get(`/o/${sent.publicId}/pdf`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("application/pdf");
  const body = await res.body();
  expect(body.subarray(0, 5).toString()).toBe("%PDF-");
  expect(body.length).toBeGreaterThan(1500);

  const draft = await seedTechnician("pdf-draft", "DRAFT");
  await page.goto(`/o/${draft.publicId}`);
  await expect(page.getByRole("link", { name: "Baixar PDF" })).toHaveCount(0);
  expect((await page.request.get(`/o/${draft.publicId}/pdf`)).status()).toBe(404);
});
