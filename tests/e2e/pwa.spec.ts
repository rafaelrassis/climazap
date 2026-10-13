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
