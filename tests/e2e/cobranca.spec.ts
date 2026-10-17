import { expect, test, type Page } from "@playwright/test";
import { login, prisma, seedTechnician } from "./helpers";

test.afterAll(async () => {
  await prisma.$disconnect();
});

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// Cria um orçamento SENT extra para um técnico já criado pelo seedTechnician (que usa o número 1)
async function addSentQuote(
  userId: string,
  number: number,
  customerName: string,
  data: { sentAt: Date; validUntil: Date },
) {
  const quote = await prisma.quote.create({
    data: {
      userId,
      number,
      customerName,
      customerPhone: "11977776666",
      status: "SENT",
      totalCents: 30000,
      sentAt: data.sentAt,
      validUntil: data.validUntil,
      items: {
        create: [{ description: "Instalação de split", unit: "un", quantity: 1, unitPriceCents: 30000, totalCents: 30000 }],
      },
    },
  });
  await prisma.user.update({ where: { id: userId }, data: { quoteSeq: number } });
  return quote;
}

// Card do orçamento na seção "Sem resposta ou vencendo" do /inicio, localizado pelo nome do cliente
function card(page: Page, customerName: string) {
  return page
    .locator("section", { has: page.getByRole("heading", { name: "Sem resposta ou vencendo" }) })
    .locator("> div")
    .filter({ hasText: customerName });
}

// O botão Cobrar abre o WhatsApp em outra aba: interceptamos para não sair do app de teste
async function stubWhatsApp(page: Page) {
  await page.context().route("https://wa.me/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>wa.me stub</body></html>" }),
  );
}

async function nudgeLink(page: Page, customerName: string) {
  const href = await card(page, customerName).getByRole("link", { name: /^Cobrar/ }).getAttribute("href");
  expect(href, `link Cobrar de ${customerName}`).toBeTruthy();
  const url = new URL(href!);
  return { url, text: url.searchParams.get("text") ?? "" };
}

async function clickNudge(page: Page, customerName: string) {
  const popup = page.waitForEvent("popup");
  await card(page, customerName).getByRole("link", { name: /^Cobrar/ }).click();
  await (await popup).close();
}

test("cobrar e adiar: painel, histórico, modelo editável e layout em 360px", async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 360, height: 740 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await stubWhatsApp(page);

  // A: enviado há 3 dias, vence em 5 dias. B: vence em 12h. C: parado, vence em 10 dias. D: parado (testa o modelo)
  const t = await seedTechnician("cob", "SENT", {
    customerName: "Ana Alfa",
    sentAt: new Date(Date.now() - 3 * DAY),
    validUntil: new Date(Date.now() + 5 * DAY),
  });
  const a = { id: t.quoteId, publicId: t.publicId, name: "Ana Alfa" };
  const bQuote = await addSentQuote(t.userId, 2, "Beto Beta", {
    sentAt: new Date(Date.now() - 1 * DAY),
    validUntil: new Date(Date.now() + 12 * HOUR),
  });
  const cQuote = await addSentQuote(t.userId, 3, "Caio Gama", {
    sentAt: new Date(Date.now() - 3 * DAY),
    validUntil: new Date(Date.now() + 10 * DAY),
  });
  const dQuote = await addSentQuote(t.userId, 4, "Dora Delta", {
    sentAt: new Date(Date.now() - 3 * DAY),
    validUntil: new Date(Date.now() + 10 * DAY),
  });

  await login(page, t.email);
  await page.goto("/inicio");

  // 2. seção com A, B, C e D; B mostra "vence em até 24h" e não pode ser adiado
  await expect(page.getByRole("heading", { name: "Sem resposta ou vencendo" })).toBeVisible();
  for (const n of ["Ana Alfa", "Beto Beta", "Caio Gama", "Dora Delta"]) {
    await expect(card(page, n)).toHaveCount(1);
  }
  await expect(card(page, "Beto Beta").getByText("vence em até 24h")).toBeVisible();
  await expect(card(page, "Beto Beta").getByRole("button", { name: "Adiar 3 dias" })).toHaveCount(0);
  await expect(card(page, "Ana Alfa").getByRole("button", { name: "Adiar 3 dias" })).toBeVisible();

  // 7. 360px: sem rolagem horizontal e alvos de toque >= 44px
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const n of ["Ana Alfa", "Beto Beta"]) {
    const box = await card(page, n).getByRole("link", { name: /^Cobrar/ }).boundingBox();
    expect(box?.height ?? 0, `altura do Cobrar de ${n}`).toBeGreaterThanOrEqual(44);
  }
  const snoozeBox = await card(page, "Ana Alfa").getByRole("button", { name: "Adiar 3 dias" }).boundingBox();
  expect(snoozeBox?.height ?? 0).toBeGreaterThanOrEqual(44);

  // 3. Cobrar de A: wa.me/55..., texto padrão com número e link público; B usa a mensagem de urgência
  const linkA = await nudgeLink(page, "Ana Alfa");
  expect(linkA.url.host).toBe("wa.me");
  expect(linkA.url.pathname).toBe("/5511977776666");
  expect(linkA.text).toContain("Conseguiu ver o orçamento #1");
  expect(linkA.text).toContain(`/o/${a.publicId}`);
  const linkB = await nudgeLink(page, "Beto Beta");
  expect(linkB.text).toContain("vence em breve");
  expect(linkB.text).toContain(`/o/${bQuote.publicId}`);

  // 4. clicar em Cobrar de A: some do painel e grava 1 NUDGE
  await clickNudge(page, "Ana Alfa");
  await expect(card(page, "Ana Alfa")).toHaveCount(0);
  await expect
    .poll(() => prisma.quoteNudge.count({ where: { quoteId: a.id, kind: "NUDGE" } }))
    .toBe(1);
  expect(await prisma.quote.findUnique({ where: { id: a.id }, select: { lastNudgeAt: true } })).toMatchObject({
    lastNudgeAt: expect.any(Date),
  });

  // 5. Adiar C: toast, sai do painel, 1 SNOOZE e a lista mostra "adiado até DD/MM" (hoje + 3 dias)
  await card(page, "Caio Gama").getByRole("button", { name: "Adiar 3 dias" }).click();
  await expect(page.getByText("Cobrança adiada por 3 dias")).toBeVisible();
  await expect(card(page, "Caio Gama")).toHaveCount(0);
  await expect
    .poll(() => prisma.quoteNudge.count({ where: { quoteId: cQuote.id, kind: "SNOOZE" } }))
    .toBe(1);

  const expected = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(Date.now() + 3 * DAY));
  await page.goto("/orcamentos");
  await expect(page.getByText(`adiado até ${expected}`)).toBeVisible();
  await expect(page.getByText("cobrado hoje")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  // 6. modelo próprio em Ajustes passa a valer no Cobrar seguinte (D) e "Voltar ao padrão" restaura
  await page.goto("/ajustes");
  await page.getByLabel("Mensagem enviada pelo botão Cobrar").fill("Opa {cliente}, orçamento {numero} pendente. {link}");
  await page.getByRole("button", { name: "Salvar mensagem de cobrança" }).click();
  await expect(page.getByText("Mensagem de cobrança salva")).toBeVisible();

  await page.goto("/inicio");
  const custom = await nudgeLink(page, "Dora Delta");
  expect(custom.text).toContain("Opa Dora Delta, orçamento 4 pendente.");
  expect(custom.text).toContain(`/o/${dQuote.publicId}`);
  // vencendo em breve continua com a mensagem de urgência, mesmo com modelo próprio
  expect((await nudgeLink(page, "Beto Beta")).text).toContain("vence em breve");

  await page.goto("/ajustes");
  await page.getByRole("button", { name: "Voltar ao padrão" }).click();
  await expect(page.getByText("Voltou ao modelo padrão")).toBeVisible();
  await expect(page.getByLabel("Mensagem enviada pelo botão Cobrar")).toHaveValue(/Conseguiu ver o orçamento #\{numero\}/);

  await page.goto("/inicio");
  const restored = await nudgeLink(page, "Dora Delta");
  expect(restored.text).toContain("Conseguiu ver o orçamento #4");

  await ctx.close();
});

test("cobrar e adiar só valem para o dono do orçamento", async ({ page }) => {
  const dono = await seedTechnician("cobdono", "SENT", {
    sentAt: new Date(Date.now() - 3 * DAY),
    validUntil: new Date(Date.now() + 5 * DAY),
  });
  const outro = await seedTechnician("cobout", "SENT", {
    sentAt: new Date(Date.now() - 3 * DAY),
    validUntil: new Date(Date.now() + 5 * DAY),
  });
  await login(page, outro.email);
  await page.goto("/inicio");
  // o painel do outro técnico não mostra o orçamento do dono e nada foi gravado para ele
  await expect(page.getByText(dono.customerName)).toHaveCount(0);
  expect(await prisma.quoteNudge.count({ where: { quoteId: dono.quoteId } })).toBe(0);
});
