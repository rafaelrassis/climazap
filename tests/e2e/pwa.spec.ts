import { expect, test } from "@playwright/test";
import { login, prisma, seedTechnician } from "./helpers";

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("service worker é servido como JavaScript sem cache e não faz cache de páginas", async ({ request }) => {
  const res = await request.get("/sw.js");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("javascript");
  expect(res.headers()["cache-control"]).toContain("no-cache");
  const body = await res.text();
  expect(body).toContain('addEventListener("push"');
  expect(body).toContain('addEventListener("notificationclick"');
  expect(body).not.toContain("caches."); // sem cache offline de páginas autenticadas
});

test("manifest, ícones e ajustes de avisos", async ({ page, request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.start_url).toBe("/inicio");
  expect(manifest.display).toBe("standalone");

  const t = await seedTechnician("pwa", "SENT");
  await login(page, t.email);
  await page.goto("/ajustes");
  await expect(page.getByText("Avisos no celular")).toBeVisible();
  // sem chaves VAPID no servidor de teste, o navegador informa que não há suporte (sem botão)
  await expect(page.getByText(/não permite avisos|Verificando/)).toBeVisible();
});

test("página 404 em português: logado e no link público", async ({ page }) => {
  // sem login, rota desconhecida cai no login (a área do app é protegida)
  await page.goto("/rota-que-nao-existe");
  await expect(page).toHaveURL(/\/login/);

  // link público inexistente: 404 com a página amigável
  const pub = await page.goto("/o/00000000-0000-4000-8000-000000000000");
  expect(pub?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();

  // logado, rota desconhecida também mostra a 404 amigável
  const t = await seedTechnician("nf", "SENT");
  await login(page, t.email);
  const res = await page.goto("/rota-que-nao-existe");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ir para o início" })).toBeVisible();
});
