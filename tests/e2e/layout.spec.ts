import { expect, test } from "@playwright/test";
import { login, prisma, seedTechnician } from "./helpers";

test.afterAll(async () => {
  await prisma.$disconnect();
});

// Regra do projeto: tudo funciona de 320/360px a 430px, sem rolagem horizontal e sem erros no console
const WIDTHS = [320, 360, 390, 430];

for (const width of WIDTHS) {
  test(`sem estouro horizontal nem erros em ${width}px`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width, height: 740 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const problems: string[] = [];
    page.on("pageerror", (e) => problems.push(`pageerror ${page.url()}: ${e}`));
    page.on("console", (m) => {
      if (m.type() === "error") problems.push(`console ${page.url()}: ${m.text().slice(0, 160)}`);
    });
    page.on("response", (r) => {
      if (r.status() >= 400 && !r.url().includes("/o/00000000")) problems.push(`http ${r.status()} ${r.url()}`);
    });

    const t = await seedTechnician(`lay${width}`, "SENT", {
      reminderAt: new Date(Date.now() - 1000),
      sentAt: new Date(Date.now() - 3 * 86_400_000),
      customerName: "Cliente Com Um Nome Bastante Longo Para Testar Quebra",
    });
    await prisma.quote.update({ where: { id: t.quoteId }, data: { status: "SENT" } });

    const paths = [
      "/login",
      "/cadastro",
      "/esqueci-senha",
      "/redefinir-senha",
      "/privacidade",
      "/termos",
      `/o/${t.publicId}`,
    ];
    const authed = [
      "/inicio",
      "/orcamentos",
      "/orcamentos/novo",
      `/orcamentos/${t.quoteId}`,
      `/orcamentos/${t.quoteId}/editar`,
      "/servicos",
      "/clientes",
      `/clientes/${t.customerId}`,
      `/orcamentos/novo?cliente=${t.customerId}`,
      "/ajustes",
    ];

    const check = async (path: string) => {
      await page.goto(path, { waitUntil: "networkidle" });
      const { sw, iw } = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        iw: window.innerWidth,
      }));
      expect(sw, `${path} estourou a largura (${sw} > ${iw})`).toBeLessThanOrEqual(iw);
    };

    for (const p of paths) await check(p);
    await login(page, t.email);
    for (const p of authed) await check(p);

    // gaveta de serviços aberta também não pode estourar
    await page.goto("/orcamentos/novo", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Adicionar serviço" }).click();
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    expect(problems).toEqual([]);
    await ctx.close();
  });
}
