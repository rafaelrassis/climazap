import { expect, test } from "@playwright/test";

// Fluxo que gera dinheiro: técnico cria orçamento -> envia -> cliente aprova pelo link -> técnico marca como pago
test("criar, enviar, aprovar pelo link público e marcar como pago", async ({ page, browser }) => {
  // 1. Cadastro (login automático)
  await page.goto("/cadastro");
  await page.getByLabel("Nome").fill("Técnico E2E");
  await page.getByLabel("E-mail").fill("e2e@fechouclima.com.br");
  await page.getByLabel("Senha").fill("senha123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/inicio$/);

  // 2. Novo orçamento com item avulso
  await page.goto("/orcamentos/novo");
  await page.getByLabel("Nome do cliente").fill("Maria Cliente");
  await page.getByLabel("WhatsApp do cliente").fill("11999990000");
  await page.getByRole("button", { name: "Adicionar serviço" }).click();
  await page.getByRole("button", { name: "+ Item avulso" }).click();
  await page.getByLabel("Descrição do item").fill("Instalação de split 12.000 BTUs");
  await page.getByLabel("Preço unitário").fill("45000");
  await page.getByRole("button", { name: "Salvar rascunho" }).click();

  // 3. Detalhe do orçamento: rascunho
  await expect(page).toHaveURL(/\/orcamentos$/);
  await page.getByRole("link", { name: /#1 · Maria Cliente/ }).click();
  await expect(page.getByRole("heading", { name: "Orçamento #1" })).toBeVisible();
  await expect(page.getByText("Rascunho", { exact: true })).toBeVisible();

  const detailUrl = page.url();

  // 4. Enviar no WhatsApp: captura o wa.me (externo) e extrai o link público da mensagem
  let waUrl = "";
  await page.route("https://wa.me/**", (route) => {
    waUrl = route.request().url();
    return route.abort();
  });
  await page.getByRole("button", { name: "Enviar no WhatsApp" }).click();
  await expect.poll(() => waUrl).not.toBe("");
  expect(waUrl).toContain("wa.me/5511999990000");
  const message = new URL(waUrl).searchParams.get("text") ?? "";
  const publicLink = message.match(/https?:\/\/\S+\/o\/[0-9a-f-]{36}/)?.[0];
  expect(publicLink).toBeTruthy();

  // 5. Cliente (sem login, contexto novo) vê e aprova
  const clientCtx = await browser.newContext();
  const client = await clientCtx.newPage();
  await client.goto(publicLink!);
  await expect(client.getByText("Instalação de split 12.000 BTUs")).toBeVisible();
  await expect(client.getByText("R$ 450,00").first()).toBeVisible();
  // página pública não expõe telefone
  await expect(client.getByText("99999")).toHaveCount(0);
  await client.getByRole("button", { name: "Aprovar orçamento" }).click();
  await client.getByRole("button", { name: "Sim, aprovar" }).click();
  await expect(client.getByText(/Aprovado.*Obrigado/)).toBeVisible();
  await clientCtx.close();

  // 6. Técnico vê aprovado e marca como pago
  await page.goto(detailUrl);
  await expect(page.getByText("Aprovado", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Marcar como pago" }).click();
  await expect(page.getByText(/Aprovado · Pago/)).toBeVisible();

  // 7. Dashboard: valor aprovado no mês aparece
  await page.goto("/inicio");
  await expect(page.getByText("Aprovado no mês")).toBeVisible();
  await expect(page.getByText("R$ 450,00").first()).toBeVisible();
});

test("rotas do técnico exigem login e o link público não", async ({ page }) => {
  await page.goto("/orcamentos");
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/o/00000000-0000-0000-0000-000000000000").catch(() => {});
  await expect(page).not.toHaveURL(/\/login/);
});
