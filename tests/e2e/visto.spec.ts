import { expect, test } from "@playwright/test";
import { login, newClientContext, prisma, seedTechnician } from "./helpers";

test.afterAll(async () => {
  await prisma.$disconnect();
});

const DAY = 86_400_000;

test("visto: beacon no link público, selo no painel e variante na cobrança", async ({ page, browser }) => {
  const t = await seedTechnician("visto", "SENT", {
    customerName: "Aberto Alfa",
    sentAt: new Date(Date.now() - 2 * DAY),
    validUntil: new Date(Date.now() + 5 * DAY),
  });
  const nunca = await prisma.quote.create({
    data: {
      userId: t.userId,
      number: 2,
      customerName: "Nunca Beta",
      customerPhone: "11977776666",
      status: "SENT",
      totalCents: 30000,
      sentAt: new Date(Date.now() - 2 * DAY),
      validUntil: new Date(Date.now() + 5 * DAY),
      items: { create: [{ description: "Instalação de split", unit: "un", quantity: 1, unitPriceCents: 30000, totalCents: 30000 }] },
    },
  });
  await prisma.user.update({ where: { id: t.userId }, data: { quoteSeq: 2 } });

  // 1. antes de abrir: ambos "não abriu o link" em /orcamentos
  await login(page, t.email);
  await page.goto("/orcamentos");
  await expect(page.getByText("não abriu o link")).toHaveCount(2);

  // 2. cliente (sem login, outra aba) abre o link de Aberto Alfa
  const clientCtx = await newClientContext(browser);
  const client = await clientCtx.newPage();
  await client.goto(`/o/${t.publicId}`);
  await expect(client.getByText("Aprovar orçamento")).toBeVisible();
  await expect.poll(async () => (await prisma.quote.findUniqueOrThrow({ where: { id: t.quoteId } })).viewedAt).not.toBeNull();
  await clientCtx.close();

  // 3. detalhe do técnico: "Visto em" para quem abriu
  await page.goto(`/orcamentos/${t.quoteId}`);
  await expect(page.getByText(/^Visto em /)).toBeVisible();

  // 4. detalhe do nunca aberto: "Ainda não visto"
  await page.goto(`/orcamentos/${nunca.id}`);
  await expect(page.getByText("Ainda não visto")).toBeVisible();

  // 5. lista: selo correto para cada um
  await page.goto("/orcamentos");
  await expect(page.getByText("visto", { exact: true })).toBeVisible();
  await expect(page.getByText("não abriu o link")).toHaveCount(1);

  // 6. painel: Cobrar de quem nunca abriu usa a variante; quem abriu usa a mensagem padrão
  await page.goto("/inicio");
  const section = page.locator("section", { has: page.getByRole("heading", { name: "Sem resposta ou vencendo" }) });
  const hrefNunca = await section.locator("> div").filter({ hasText: "Nunca Beta" }).getByRole("link", { name: /^Cobrar/ }).getAttribute("href");
  const hrefAberto = await section.locator("> div").filter({ hasText: "Aberto Alfa" }).getByRole("link", { name: /^Cobrar/ }).getAttribute("href");
  const textNunca = new URL(hrefNunca!).searchParams.get("text") ?? "";
  const textAberto = new URL(hrefAberto!).searchParams.get("text") ?? "";
  expect(textNunca).toContain("Conseguiu abrir o link?");
  expect(textAberto).toContain("Conseguiu ver o orçamento #1");
});
