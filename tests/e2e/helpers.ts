import type { Page } from "@playwright/test";

let n = 0;

// Cadastra um técnico novo (login automático) e cai em /inicio
export async function registerTechnician(page: Page, label: string) {
  n += 1;
  // cada técnico de teste vem de um IP diferente: o cadastro tem rate limit por IP (15/hora)
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": `198.51.100.${n}` });
  await page.goto("/cadastro");
  await page.getByLabel("Nome").fill(`Técnico ${label}`);
  await page.getByLabel("E-mail").fill(`${label}-${n}-${Date.now()}@fechouclima.com.br`);
  await page.getByLabel("Senha").fill("senha123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.waitForURL(/\/inicio$/);
}
