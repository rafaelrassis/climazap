import { expect, test, type Locator, type Page } from "@playwright/test";
import { login, prisma, seedTechnician } from "./helpers";

test.afterAll(async () => {
  await prisma.$disconnect();
});

const DAY = 86_400_000;
const HOUR = 3_600_000;
let n = 0;

// Cria um orçamento SENT extra para o mesmo técnico (seedTechnician só cria o primeiro)
async function addQuote(userId: string, number: number, name: string, validInMs: number) {
  n += 1;
  const customer = await prisma.customer.create({
    data: { userId, name, phone: `11900${String(10000 + n).padStart(6, "0")}`, address: "Rua Teste, 1" },
  });
  return prisma.quote.create({
    data: {
      userId,
      customerId: customer.id,
      number,
      customerName: customer.name,
      customerPhone: customer.phone,
      status: "SENT",
      totalCents: 30000,
      sentAt: new Date(Date.now() - 3 * DAY),
      validUntil: new Date(Date.now() + validInMs),
    },
  });
}

function textOf(href: string) {
  return new URL(href).searchParams.get("text") ?? "";
}

function cardFor(scope: Page | Locator, name: string) {
  return scope.locator(".rounded-3xl").filter({ hasText: name });
}

// Clica num link que abre o WhatsApp (target="_blank") sem navegar de fato para lá
async function clickOpeningWhatsApp(page: Page, link: Locator) {
  const [popup] = await Promise.all([page.waitForEvent("popup"), link.click()]);
  await popup.close().catch(() => {});
}

test("fluxo de cobrança: aviso de vencimento, cobrar, adiar e modelo de mensagem", async ({ page }) => {
  const t = await seedTechnician("cob", "SENT", {
    sentAt: new Date(Date.now() - 3 * DAY),
    validUntil: new Date(Date.now() + 5 * DAY),
  }); // A: enviado há 3 dias, vence em 5 dias
  const b = await addQuote(t.userId, 2, "Cliente Urgente", 12 * HOUR); // B: vence em 12h

  await login(page, t.email);
  await page.goto("/inicio");

  const section = page.locator("section").filter({ has: page.getByRole("heading", { name: "Sem resposta ou vencendo" }) });
  await expect(section.getByRole("heading", { name: "Sem resposta ou vencendo" })).toBeVisible();

  const cardA = cardFor(section, t.customerName);
  const cardB = cardFor(section, b.customerName);
  await expect(cardA).toBeVisible();
  await expect(cardB).toBeVisible();

  // B vence em breve: mostra o selo e não oferece "Adiar"
  await expect(cardB.getByText("vence em até 24h")).toBeVisible();
  await expect(cardB.getByRole("button", { name: "Adiar 3 dias" })).toHaveCount(0);

  // Cobrar de A: link para o WhatsApp com a mensagem padrão e o link público
  const hrefA = await cardA.getByRole("link", { name: "Cobrar" }).getAttribute("href");
  expect(hrefA).toMatch(/^https:\/\/wa\.me\/55\d+\?text=/);
  const msgA = textOf(hrefA!);
  expect(msgA).toContain("Conseguiu ver o orçamento #1");
  expect(msgA).toContain(`/o/${t.publicId}`);

  // Cobrar de B: mensagem de urgência (vence em até 24h)
  const hrefB = await cardB.getByRole("link", { name: "Cobrar" }).getAttribute("href");
  const msgB = textOf(hrefB!);
  expect(msgB).toContain("vence em breve");
  expect(msgB).toContain(`/o/${b.publicId}`);

  // Clicar em Cobrar (A): some do painel e vira 1 linha NUDGE
  await clickOpeningWhatsApp(page, cardA.getByRole("link", { name: "Cobrar" }));
  await expect(cardA).toHaveCount(0);
  const nudges = await prisma.quoteNudge.findMany({ where: { quoteId: t.quoteId } });
  expect(nudges).toMatchObject([{ kind: "NUDGE", userId: t.userId }]);

  // Orçamento C (parado, nunca cobrado): Adiar 3 dias remove do painel
  const c = await addQuote(t.userId, 3, "Cliente Parado", 5 * DAY);
  await page.goto("/inicio");
  const cardC = cardFor(section, c.customerName);
  await expect(cardC.getByRole("button", { name: "Adiar 3 dias" })).toBeVisible();
  await cardC.getByRole("button", { name: "Adiar 3 dias" }).click();
  await expect(page.getByText("Cobrança adiada por 3 dias")).toBeVisible();
  await expect(cardC).toHaveCount(0);

  const snoozes = await prisma.quoteNudge.findMany({ where: { quoteId: c.id } });
  expect(snoozes).toMatchObject([{ kind: "SNOOZE", userId: t.userId }]);

  const updatedC = await prisma.quote.findUniqueOrThrow({ where: { id: c.id } });
  const adiadoAte = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }).format(
    new Date(updatedC.lastNudgeAt!.getTime() + 2 * DAY),
  );
  await page.goto("/orcamentos");
  await expect(cardFor(page, c.customerName).getByText(`adiado até ${adiadoAte}`)).toBeVisible();

  // Modelo de cobrança em Ajustes: o próximo Cobrar usa o texto novo
  const d = await addQuote(t.userId, 4, "Cliente Modelo", 5 * DAY);
  await page.goto("/ajustes");
  // há dois formulários com botões "Salvar"/"Voltar ao padrão" na página (mensagem do orçamento e mensagem de cobrança): escopar neste
  const nudgeSection = page.locator("div.space-y-3").filter({ hasText: "Mensagem de cobrança" });
  const templateBox = nudgeSection.getByLabel("Mensagem enviada pelo botão Cobrar");
  await templateBox.fill("Oi {cliente}! Olha o orçamento #{numero}: {link}");
  await nudgeSection.getByRole("button", { name: "Salvar mensagem de cobrança" }).click();
  await expect(page.getByText("Mensagem de cobrança salva")).toBeVisible();

  await page.goto("/orcamentos");
  const hrefD1 = await cardFor(page, d.customerName).getByRole("link", { name: "Cobrar" }).getAttribute("href");
  expect(textOf(hrefD1!)).toContain("Olha o orçamento #4");

  // "Voltar ao padrão" restaura o modelo padrão
  await page.goto("/ajustes");
  await nudgeSection.getByRole("button", { name: "Voltar ao padrão" }).click();
  await expect(page.getByText("Voltou ao modelo padrão")).toBeVisible();
  await expect(templateBox).not.toHaveValue(/Olha o orçamento/);

  await page.goto("/orcamentos");
  const hrefD2 = await cardFor(page, d.customerName).getByRole("link", { name: "Cobrar" }).getAttribute("href");
  expect(textOf(hrefD2!)).toContain("Conseguiu ver o orçamento #4");
});

test("360px: painel de cobrança sem estouro horizontal e alvos de toque >= 44px", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const t = await seedTechnician("w360", "SENT", {
    sentAt: new Date(Date.now() - 3 * DAY),
    validUntil: new Date(Date.now() + 5 * DAY),
  });
  await login(page, t.email);

  for (const path of ["/inicio", "/orcamentos", "/ajustes"]) {
    await page.goto(path, { waitUntil: "networkidle" });
    const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    expect(sw, `${path} estourou a largura (${sw} > ${iw})`).toBeLessThanOrEqual(iw);
  }

  await page.goto("/inicio", { waitUntil: "networkidle" });
  const cobrarBox = await page.getByRole("link", { name: "Cobrar" }).first().boundingBox();
  expect(cobrarBox?.height).toBeGreaterThanOrEqual(44);
  const adiarBox = await page.getByRole("button", { name: "Adiar 3 dias" }).first().boundingBox();
  expect(adiarBox?.height).toBeGreaterThanOrEqual(44);

  await ctx.close();
});
