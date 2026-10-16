import { expect, test } from "@playwright/test";
import { registerTechnician } from "./helpers";

// PNG 1x1 válido
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

test("ajustes: resumo semanal, template do WhatsApp e logo persistem", async ({ page }) => {
  await registerTechnician(page, "cfg");
  await page.goto("/ajustes");

  // resumo semanal: ativo por padrão, desativa e persiste
  const digest = page.getByRole("checkbox", { name: /Resumo semanal por e-mail/ });
  await expect(digest).toBeChecked();
  await digest.uncheck();
  await expect(page.getByText("Resumo semanal desativado")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: /Resumo semanal por e-mail/ })).not.toBeChecked();

  // template: modelo "Curto", prévia, salvar e persistir
  await page.getByRole("button", { name: "Curto" }).click();
  await expect(page.getByText("Aprove aqui: https://fechouclima.com.br/o/...")).toBeVisible();
  await page.getByRole("button", { name: "Salvar mensagem", exact: true }).click();
  await expect(page.getByText("Mensagem salva")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Mensagem do WhatsApp")).toHaveValue(/Aprove aqui: \{link\}/);

  // variável desconhecida bloqueia o salvar
  await page.getByLabel("Mensagem do WhatsApp").fill("Oi {nome}, veja {link}");
  await expect(page.getByText(/Variável desconhecida: \{nome\}/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Salvar mensagem", exact: true })).toBeDisabled();

  // sem {link} o servidor também recusa (cliente não consegue abrir o orçamento)
  await page.getByLabel("Mensagem do WhatsApp").fill("Orçamento pronto, fale comigo");
  await page.getByRole("button", { name: "Salvar mensagem", exact: true }).click();
  await expect(page.getByText("A mensagem precisa conter {link}")).toBeVisible();

  // logo: enviar (PNG reduzido no navegador), aparece e remove
  await expect(page.getByAltText("Logo atual")).toHaveCount(0);
  await page.locator('input[type="file"]').setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG_1X1 });
  await expect(page.getByText("Logo salva")).toBeVisible();
  await expect(page.getByAltText("Logo atual")).toBeVisible();
  const res = await page.request.get((await page.getByAltText("Logo atual").getAttribute("src"))!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("image/png");

  await page.getByRole("button", { name: "Remover", exact: true }).click();
  await expect(page.getByText("Logo removida")).toBeVisible();
  await expect(page.getByAltText("Logo atual")).toHaveCount(0);
});

test("logo aparece na página pública do orçamento", async ({ page, browser }) => {
  await registerTechnician(page, "logo");
  await page.goto("/ajustes");
  await page.locator('input[type="file"]').setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG_1X1 });
  await expect(page.getByAltText("Logo atual")).toBeVisible();

  await page.goto("/orcamentos/novo");
  await page.getByLabel("Nome do cliente").fill("Cliente Logo");
  await page.getByLabel("WhatsApp do cliente").fill("11988880000");
  await page.getByRole("button", { name: "Adicionar serviço" }).click();
  await page.getByRole("button", { name: "+ Item avulso" }).click();
  await page.getByLabel("Descrição do item").fill("Serviço com logo");
  await page.getByLabel("Preço unitário").fill("10000");
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await page.getByRole("link", { name: /#1 · Cliente Logo/ }).click();

  let waUrl = "";
  await page.route("https://wa.me/**", (route) => {
    waUrl = route.request().url();
    return route.abort();
  });
  await page.getByRole("button", { name: "Enviar no WhatsApp" }).click();
  await expect.poll(() => waUrl).not.toBe("");
  const link = (new URL(waUrl).searchParams.get("text") ?? "").match(/https?:\/\/\S+\/o\/[0-9a-f-]{36}/)![0];

  const ctx = await browser.newContext();
  const client = await ctx.newPage();
  await client.goto(link);
  const img = client.locator('img[src*="/logo"]');
  await expect(img).toBeVisible();
  expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  await ctx.close();
});
