import { expect, test, type Page } from "@playwright/test";
import { login, prisma, seedTechnician } from "./helpers";

test.afterAll(async () => {
  await prisma.$disconnect();
});

async function addCustomItem(page: Page, description: string, priceDigits: string) {
  await page.getByRole("button", { name: "Adicionar serviço" }).click();
  await page.getByRole("button", { name: "+ Item avulso" }).click();
  await page.getByLabel("Descrição do item").last().fill(description);
  await page.getByLabel("Preço unitário").last().fill(priceDigits);
}

test("rascunho do formulário: restaura depois de recarregar, descarta, e some ao salvar ou sair", async ({ page }) => {
  const t = await seedTechnician("draft", "SENT");
  await login(page, t.email);

  await page.goto("/orcamentos/novo");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Nome do cliente").fill("Cliente do Rascunho");
  await page.getByLabel("WhatsApp do cliente").fill("11955554444");
  await addCustomItem(page, "Item guardado", "12000");
  await page.waitForTimeout(700); // espera do salvamento automático (400 ms)

  await page.reload();
  await expect(page.getByText("Rascunho restaurado")).toBeVisible();
  await expect(page.getByLabel("Nome do cliente")).toHaveValue("Cliente do Rascunho");
  await expect(page.getByLabel("WhatsApp do cliente")).toHaveValue("(11) 95555-4444");
  await expect(page.getByLabel("Descrição do item")).toHaveValue("Item guardado");
  await expect(page.getByText("R$ 120,00").first()).toBeVisible();

  // descartar limpa tudo, inclusive o que ficou guardado
  await page.getByRole("button", { name: "Descartar" }).click();
  await expect(page.getByLabel("Nome do cliente")).toHaveValue("");
  await page.waitForTimeout(700);
  await page.reload();
  await expect(page.getByText("Rascunho restaurado")).toHaveCount(0);
  await expect(page.getByLabel("Nome do cliente")).toHaveValue("");

  // salvar o orçamento apaga o rascunho local
  await page.getByLabel("Nome do cliente").fill("Vai Salvar");
  await page.getByLabel("WhatsApp do cliente").fill("11944443333");
  await addCustomItem(page, "Item salvo", "5000");
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page).toHaveURL(/\/orcamentos$/);
  await page.goto("/orcamentos/novo");
  await expect(page.getByLabel("Nome do cliente")).toHaveValue("");

  // sair limpa rascunhos do aparelho (aparelho compartilhado)
  await page.getByLabel("Nome do cliente").fill("Dado sensível");
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("fc:draft:")).length)).toBe(1);
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login/);
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("fc:draft:")).length)).toBe(0);
});

test("autocomplete de clientes preenche nome, telefone e endereço", async ({ page }) => {
  const t = await seedTechnician("auto", "SENT");
  await login(page, t.email);
  await page.goto("/orcamentos/novo");
  await page.waitForLoadState("networkidle");

  await page.getByLabel("Nome do cliente").fill("Cli");
  await page.getByRole("button", { name: new RegExp(t.customerName) }).click();
  await expect(page.getByLabel("Nome do cliente")).toHaveValue(t.customerName);
  await expect(page.getByLabel("WhatsApp do cliente")).toHaveValue("(11) 97777-6666");
  await expect(page.getByLabel("Endereço")).toHaveValue("Rua das Flores, 10");
  // depois de escolher, a lista de sugestões some
  await expect(page.getByRole("button", { name: new RegExp(t.customerName) })).toHaveCount(0);

  // busca por telefone também funciona
  await page.getByLabel("Nome do cliente").fill("97777");
  await expect(page.getByRole("button", { name: new RegExp(t.customerName) })).toBeVisible();
});

test("validações do formulário e cálculo do total com quantidade e desconto", async ({ page }) => {
  const t = await seedTechnician("val", "SENT");
  await login(page, t.email);
  await page.goto("/orcamentos/novo");
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page.getByText("Informe o nome do cliente")).toBeVisible();

  await page.getByLabel("Nome do cliente").fill("Maria");
  await page.getByLabel("WhatsApp do cliente").fill("123");
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page.getByText("Telefone inválido")).toBeVisible();

  await page.getByLabel("WhatsApp do cliente").fill("11999990000");
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page.getByText("Adicione ao menos 1 serviço")).toBeVisible();

  await addCustomItem(page, "Instalação", "10000"); // R$ 100,00
  await page.getByRole("button", { name: "Aumentar" }).click(); // quantidade 2 => R$ 200,00
  await expect(page.getByLabel("Quantidade")).toHaveValue("2");
  await expect(page.getByText("R$ 200,00").first()).toBeVisible();

  await page.getByLabel("Desconto", { exact: true }).fill("5000"); // R$ 50,00 => total R$ 150,00
  await expect(page.getByText("R$ 150,00").first()).toBeVisible();

  await page.getByLabel("Desconto", { exact: true }).fill("99999"); // maior que o subtotal
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page.getByText("Desconto maior que o subtotal")).toBeVisible();

  await page.getByLabel("Desconto", { exact: true }).fill("5000");
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page).toHaveURL(/\/orcamentos$/);
  const q = await prisma.quote.findFirstOrThrow({ where: { userId: t.userId, customerName: "Maria" }, include: { items: true } });
  expect(q.totalCents).toBe(15000);
  expect(q.discountCents).toBe(5000);
  expect(Number(q.items[0].quantity)).toBe(2);
});

test("navegação inferior: item ativo, troca de tela e escondida no formulário", async ({ page }) => {
  const t = await seedTechnician("nav", "SENT");
  await login(page, t.email);
  const nav = page.getByRole("navigation", { name: "Navegação principal" });

  await expect(nav.getByRole("link", { name: "Início" })).toHaveAttribute("aria-current", "page");
  await nav.getByRole("link", { name: "Clientes" }).click();
  await expect(page).toHaveURL(/\/clientes$/);
  await expect(nav.getByRole("link", { name: "Clientes" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Início" })).not.toHaveAttribute("aria-current", "page");

  await nav.getByRole("link", { name: "Orçamentos" }).click();
  await page.goto(`/orcamentos/${t.quoteId}`);
  await expect(nav.getByRole("link", { name: "Orçamentos" })).toHaveAttribute("aria-current", "page"); // subrota mantém o item ativo

  await page.goto("/orcamentos/novo");
  await expect(nav).toHaveCount(0);
  await page.goto(`/orcamentos/${t.quoteId}/editar`);
  await expect(nav).toHaveCount(0);
});
