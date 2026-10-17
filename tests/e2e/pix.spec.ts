import { expect, test } from "@playwright/test";
import { login, newClientContext, prisma, seedTechnician, uniqueIp } from "./helpers";

test.afterAll(async () => {
  await prisma.$disconnect();
});

// CRC16/CCITT-FALSE do BR Code (reimplementado aqui de propósito: o teste confere o app de fora)
function crc16(input: string) {
  let crc = 0xffff;
  for (const ch of input) {
    crc ^= ch.charCodeAt(0) << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

test("Pix: técnico configura em Ajustes; cliente só vê depois de aprovar, com QR e copia e cola corretos", async ({ page, browser }) => {
  const t = await seedTechnician("pix", "SENT"); // total R$ 300,00
  await login(page, t.email);

  // validação da chave
  await page.goto("/ajustes");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Chave Pix").fill("11999990000"); // 11 dígitos soltos: ambíguo, não aceita
  await page.getByLabel("Cidade do recebedor").fill("Santos");
  await page.getByRole("button", { name: "Salvar Pix" }).click();
  await expect(page.getByText(/Chave inválida/)).toBeVisible();

  await page.getByLabel("Chave Pix").fill("(11) 99999-0000");
  await page.getByRole("button", { name: "Salvar Pix" }).click();
  await expect(page.getByText("Pix salvo")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Chave Pix")).toHaveValue("+5511999990000");

  // antes da aprovação o cliente não vê Pix
  const ctx = await newClientContext(browser, { permissions: ["clipboard-read", "clipboard-write"] });
  const client = await ctx.newPage();
  await client.goto(`/o/${t.publicId}`);
  await expect(client.getByText("Pagamento via Pix")).toHaveCount(0);

  // aprova: o Pix aparece com QR, chave e botões de copiar
  await client.getByRole("button", { name: "Aprovar orçamento" }).click();
  await client.getByRole("button", { name: "Sim, aprovar" }).click();
  await expect(client.getByText("Pagamento via Pix")).toBeVisible();
  await expect(client.getByAltText("QR Code do Pix")).toBeVisible();
  expect(await client.getByAltText("QR Code do Pix").getAttribute("src")).toMatch(/^data:image\/png;base64,/);
  await expect(client.getByText("Chave: +5511999990000")).toBeVisible();

  await client.getByRole("button", { name: "Copiar Pix copia e cola" }).click();
  const payload = await client.evaluate(() => navigator.clipboard.readText());
  expect(payload.startsWith("000201")).toBe(true);
  expect(payload).toContain("br.gov.bcb.pix");
  expect(payload).toContain("0114+5511999990000");
  expect(payload).toContain("5406300.00"); // R$ 300,00
  expect(payload).toContain("5802BR");
  expect(payload.slice(-4)).toBe(crc16(payload.slice(0, -4))); // CRC válido: apps de banco aceitam
  await ctx.close();

  // o técnico copia o mesmo código no detalhe, e some depois de marcar como pago
  await page.goto(`/orcamentos/${t.quoteId}`);
  await expect(page.getByRole("button", { name: /Copiar Pix copia e cola/ })).toBeVisible();
  await page.getByRole("button", { name: "Marcar como pago" }).click();
  await expect(page.getByText(/Aprovado · Pago/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Copiar Pix copia e cola/ })).toHaveCount(0);
});

test("sem Pix configurado, orçamento aprovado não mostra bloco de pagamento", async ({ page }) => {
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": uniqueIp() });
  const t = await seedTechnician("nopix", "APPROVED");
  await page.goto(`/o/${t.publicId}`);
  await expect(page.getByText(/Aprovado/).first()).toBeVisible();
  await expect(page.getByText("Pagamento via Pix")).toHaveCount(0);
});
