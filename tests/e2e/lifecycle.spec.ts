import { expect, test } from "@playwright/test";
import { login, prisma, seedTechnician } from "./helpers";

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("cliente recusa com motivo pelo link público e o técnico vê o motivo", async ({ page, browser }) => {
  const t = await seedTechnician("rej", "SENT");

  const ctx = await browser.newContext();
  const client = await ctx.newPage();
  await client.goto(`/o/${t.publicId}`);
  await client.getByRole("button", { name: "Recusar" }).click();
  await client.getByLabel("Motivo da recusa").fill("Achei o valor alto");
  await client.getByRole("button", { name: "Sim, recusar" }).click();
  await expect(client.getByText(/Orçamento recusado em/)).toBeVisible();
  await expect(client.getByRole("button", { name: "Aprovar orçamento" })).toHaveCount(0);
  await ctx.close();

  await login(page, t.email);
  await page.goto(`/orcamentos/${t.quoteId}`);
  await expect(page.getByText("Recusado", { exact: true })).toBeVisible();
  await expect(page.getByText("Achei o valor alto")).toBeVisible();
  // contraproposta: duplica com 5% de desconto como rascunho #2
  await page.getByRole("button", { name: /Contraproposta com 5% de desconto/ }).click();
  await expect(page.getByRole("heading", { name: "Orçamento #2" })).toBeVisible();
  await expect(page.getByText("-R$ 15,00")).toBeVisible();
});

test("editar orçamento enviado volta para rascunho e o link antigo não aprova mais", async ({ page, browser }) => {
  const t = await seedTechnician("edit", "SENT");
  await login(page, t.email);

  await page.goto(`/orcamentos/${t.quoteId}/editar`);
  await expect(page.getByRole("heading", { name: "Editar orçamento #1" })).toBeVisible();
  await expect(page.getByLabel("Nome do cliente")).toHaveValue(t.customerName);
  await page.getByLabel("Preço unitário").fill("40000");
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page).toHaveURL(new RegExp(`/orcamentos/${t.quoteId}$`));
  await expect(page.getByText("Rascunho", { exact: true })).toBeVisible();
  await expect(page.getByText("R$ 400,00").first()).toBeVisible();

  const ctx = await browser.newContext();
  const client = await ctx.newPage();
  await client.goto(`/o/${t.publicId}`);
  await expect(client.getByText(/está sendo atualizado/)).toBeVisible();
  await expect(client.getByRole("button", { name: "Aprovar orçamento" })).toHaveCount(0);
  await ctx.close();
});

test("expirado: renovar validade volta para Enviado", async ({ page }) => {
  const t = await seedTechnician("exp", "SENT", { validUntil: new Date(Date.now() - 2 * 86_400_000) });
  await login(page, t.email);
  await page.goto(`/orcamentos/${t.quoteId}`);
  await expect(page.getByText("Expirado", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Renovar validade/ }).click();
  await expect(page.getByText("Enviado", { exact: true })).toBeVisible();
});

test("aprovado: lembrete de manutenção aparece no início quando vence e some ao concluir", async ({ page }) => {
  const t = await seedTechnician("rem", "APPROVED", { respondedAt: new Date(Date.now() - 180 * 86_400_000) });
  await login(page, t.email);

  await page.goto(`/orcamentos/${t.quoteId}`);
  await page.getByRole("button", { name: "6 meses" }).click();
  await expect(page.getByText(/Aviso em \d{2}\/\d{2}\/\d{4}/)).toBeVisible();
  await page.getByRole("button", { name: "Remover lembrete" }).click();
  await expect(page.getByRole("button", { name: "3 meses" })).toBeVisible();

  // simula o vencimento e confere a seção "Hora da manutenção"
  await prisma.quote.update({ where: { id: t.quoteId }, data: { reminderAt: new Date(Date.now() - 1000) } });
  await page.goto("/inicio");
  await expect(page.getByText("Hora da manutenção")).toBeVisible();
  await expect(page.getByRole("link", { name: "Chamar" })).toHaveAttribute("href", /^https:\/\/wa\.me\/5511977776666\?text=/);
  await page.getByRole("button", { name: "Feito" }).click();
  await expect(page.getByText("Hora da manutenção")).toHaveCount(0);
});

test("clientes: busca, detalhe e novo orçamento pré-preenchido", async ({ page }) => {
  const t = await seedTechnician("cli", "APPROVED");
  await login(page, t.email);

  await page.goto("/clientes");
  await page.getByLabel("Buscar cliente").fill("zzz-nao-existe");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Nenhum cliente encontrado.")).toBeVisible();
  await page.getByLabel("Buscar cliente").fill("cli");
  await page.keyboard.press("Enter");
  await page.getByRole("link", { name: new RegExp(t.customerName) }).click();

  await expect(page.getByRole("heading", { name: t.customerName })).toBeVisible();
  await expect(page.getByText("1 aprovado(s) · R$ 300,00 no total")).toBeVisible();
  await expect(page.getByRole("link", { name: /#1 ·/ })).toBeVisible();

  await page.getByRole("link", { name: "Novo orçamento" }).click();
  await expect(page.getByLabel("Nome do cliente")).toHaveValue(t.customerName);
  await expect(page.getByLabel("WhatsApp do cliente")).toHaveValue("(11) 97777-6666");
  await expect(page.getByLabel("Endereço")).toHaveValue("Rua das Flores, 10");
});

test("técnico não acessa orçamento nem cliente de outro técnico", async ({ page }) => {
  const a = await seedTechnician("isoA", "SENT");
  const b = await seedTechnician("isoB", "SENT");
  await login(page, b.email);
  expect((await page.goto(`/orcamentos/${a.quoteId}`))?.status()).toBe(404);
  expect((await page.goto(`/orcamentos/${a.quoteId}/editar`))?.status()).toBe(404);
  expect((await page.goto(`/clientes/${a.customerId}`))?.status()).toBe(404);
  // pré-preenchimento com cliente alheio é ignorado
  await page.goto(`/orcamentos/novo?cliente=${a.customerId}`);
  await expect(page.getByLabel("Nome do cliente")).toHaveValue("");
});

test("clientes: editar, filtrar dormentes e excluir mantendo o orçamento", async ({ page }) => {
  const t = await seedTechnician("cadm", "APPROVED");
  await prisma.customer.update({ where: { id: t.customerId }, data: { createdAt: new Date(Date.now() - 400 * 86_400_000) } });
  await prisma.quote.update({ where: { id: t.quoteId }, data: { createdAt: new Date(Date.now() - 300 * 86_400_000) } });
  await login(page, t.email);

  // dormente: aparece no filtro e tem botão de reabordar
  await page.goto("/clientes?filtro=dormentes");
  await expect(page.getByText("Dormente")).toBeVisible();
  await expect(page.getByRole("link", { name: "Reabordar" })).toHaveAttribute("href", /^https:\/\/wa\.me\/5511977776666\?text=/);

  await page.goto(`/clientes/${t.customerId}`);
  await page.getByRole("button", { name: "Editar cliente" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Nome Corrigido");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("heading", { name: "Nome Corrigido" })).toBeVisible();

  await page.getByRole("button", { name: "Excluir cliente" }).click();
  await page.getByRole("button", { name: "Sim, excluir" }).click();
  await expect(page).toHaveURL(/\/clientes$/);
  await expect(page.getByText("Nome Corrigido")).toHaveCount(0);

  // o orçamento continua
  await page.goto(`/orcamentos/${t.quoteId}`);
  await expect(page.getByRole("heading", { name: "Orçamento #1" })).toBeVisible();
});
