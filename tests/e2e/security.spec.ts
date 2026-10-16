import { expect, test } from "@playwright/test";
import { login, prisma, seedTechnician } from "./helpers";

test.afterAll(async () => {
  await prisma.$disconnect();
});

const XSS = `<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>"'&`;

test("conteúdo com HTML/script é exibido como texto em todas as telas (sem XSS)", async ({ page, browser }) => {
  const t = await seedTechnician("xss", "SENT", { customerName: XSS, title: XSS, notes: XSS });
  await prisma.quoteItem.updateMany({ where: { quoteId: t.quoteId }, data: { description: XSS } });
  await prisma.customer.update({ where: { id: t.customerId }, data: { name: XSS, address: XSS } });
  await prisma.user.update({ where: { id: t.userId }, data: { name: XSS, companyName: XSS } });

  const dialogs: string[] = [];
  page.on("dialog", (d) => {
    dialogs.push(d.message());
    void d.dismiss();
  });

  await login(page, t.email);
  for (const path of ["/inicio", "/orcamentos", `/orcamentos/${t.quoteId}`, `/orcamentos/${t.quoteId}/editar`, "/clientes", `/clientes/${t.customerId}`, "/ajustes"]) {
    await page.goto(path, { waitUntil: "networkidle" });
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss), `XSS em ${path}`).toBeUndefined();
  }
  await page.goto(`/orcamentos/${t.quoteId}`);
  // escopado a <main>: a sidebar desktop (fora de <main>) repete o nome do usuário mas fica
  // display:none no viewport mobile do teste, o que faria .first() pegar um elemento oculto
  await expect(page.locator("main").getByText(XSS).first()).toBeVisible(); // o texto aparece literal

  // página pública, sem login
  const ctx = await browser.newContext();
  const pub = await ctx.newPage();
  pub.on("dialog", (d) => {
    dialogs.push(d.message());
    void d.dismiss();
  });
  await pub.goto(`/o/${t.publicId}`, { waitUntil: "networkidle" });
  expect(await pub.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  await expect(pub.getByText(XSS).first()).toBeVisible();
  expect(await pub.locator("script", { hasText: "__xss" }).count()).toBe(0);
  expect(await pub.locator("img[onerror]").count()).toBe(0);

  // OG image também renderiza (texto cru, sem quebrar)
  const og = await pub.request.get(`/o/${t.publicId}/opengraph-image`);
  expect(og.status()).toBe(200);
  expect(og.headers()["content-type"]).toBe("image/png");
  await ctx.close();
  expect(dialogs).toEqual([]);
});

test("login: e-mail sem distinção de maiúsculas e bloqueio com minutos de espera", async ({ page }) => {
  const t = await seedTechnician("auth", "SENT");
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": "198.51.100.220" });

  // entra mesmo digitando o e-mail em maiúsculas
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("E-mail").fill(t.email.toUpperCase());
  await page.getByLabel("Senha").fill("senha123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/inicio$/);
  await page.getByRole("button", { name: "Sair" }).click();
  await page.waitForURL(/\/login/);

  // cada tentativa só termina quando o servidor responde (a mensagem anterior fica na tela enquanto isso)
  const attempt = async (password: string) => {
    await page.getByLabel("E-mail").fill(t.email);
    await page.getByLabel("Senha").fill(password);
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/login"),
      page.getByRole("button", { name: "Entrar" }).click(),
    ]);
  };

  // limite de 8 por IP+e-mail em 15 min: o login acima já gastou 1, então 7 erradas passam e a seguinte é bloqueada
  // mesmo com a senha certa
  for (let i = 0; i < 7; i++) {
    await attempt(`errada-${i}`);
    await expect(page.getByText("E-mail ou senha inválidos")).toBeVisible();
  }
  await attempt("senha123");
  await expect(page.getByText(/Muitas tentativas\. Tente novamente em \d+ min\./)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);

  // o bloqueio é do par IP+e-mail: outro IP entra normalmente
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": "198.51.100.221" });
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("E-mail").fill(t.email);
  await page.getByLabel("Senha").fill("senha123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/inicio$/);
});

test("rotas protegidas redirecionam e as APIs privadas respondem sem vazar dados", async ({ request }) => {
  for (const path of ["/inicio", "/orcamentos", "/clientes", "/servicos", "/ajustes"]) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect([302, 307], path).toContain(res.status());
    expect(res.headers()["location"]).toContain("/login");
  }
  for (const path of ["/api/logo", "/api/meus-dados"]) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect([302, 307, 401], path).toContain(res.status());
    expect(await res.text()).not.toContain("passwordHash");
  }
  expect((await request.get("/api/cron/lembretes")).status()).toBe(401);
  expect((await request.post("/api/descadastro?u=x&t=y")).status()).toBe(403);
  const health = await (await request.get("/api/health")).json();
  expect(health).toEqual({ ok: true });
});
